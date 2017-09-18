package server

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/FrankerFaceZ/FrankerFaceZ/socketserver/server/rate"
	"github.com/pkg/errors"
)

// LastSavedMessage contains a reply to a command along with an expiration time.
type LastSavedMessage struct {
	Expires time.Time
	Data    string
}

// map is command -> channel -> data

// CachedLastMessages is of CacheTypeLastOnly.
// Not actually cleaned up by reaper goroutine every ~hour.
var CachedLastMessages = make(map[Command]map[string]LastSavedMessage)
var CachedLSMLock sync.RWMutex

func cachedMessageJanitor() {
	for {
		time.Sleep(1 * time.Hour)
		cachedMessageJanitor_do()
	}
}

func cachedMessageJanitor_do() {
	CachedLSMLock.Lock()
	defer CachedLSMLock.Unlock()

	now := time.Now()

	for cmd, chanMap := range CachedLastMessages {
		for channel, msg := range chanMap {
			if !msg.Expires.IsZero() && msg.Expires.Before(now) {
				delete(chanMap, channel)
			}
		}
		if len(chanMap) == 0 {
			delete(CachedLastMessages, cmd)
		}
	}
}

// DumpBacklogData drops all /cached_pub data.
func DumpBacklogData() {
	CachedLSMLock.Lock()
	CachedLastMessages = make(map[Command]map[string]LastSavedMessage)
	CachedLSMLock.Unlock()
}

// SendBacklogForNewClient sends any backlog data relevant to a new client.
// This should be done when the client sends a `ready` message.
// This will only send data for CacheTypePersistent and CacheTypeLastOnly because those do not involve timestamps.
func SendBacklogForNewClient(client *ClientInfo) {
	client.Mutex.Lock() // reading CurrentChannels
	curChannels := make([]string, len(client.CurrentChannels))
	copy(curChannels, client.CurrentChannels)
	client.Mutex.Unlock()

	CachedLSMLock.RLock()
	for cmd, chanMap := range CachedLastMessages {
		if chanMap == nil {
			continue
		}
		for _, channel := range curChannels {
			msg, ok := chanMap[channel]
			if ok {
				msg := ClientMessage{MessageID: -1, Command: cmd, origArguments: msg.Data}
				msg.parseOrigArguments()
				client.Send(msg)
			}
		}
	}
	CachedLSMLock.RUnlock()
}

func SendBacklogForChannel(client *ClientInfo, channel string) {
	CachedLSMLock.RLock()
	for cmd, chanMap := range CachedLastMessages {
		if chanMap == nil {
			continue
		}
		if msg, ok := chanMap[channel]; ok {
			msg := ClientMessage{MessageID: -1, Command: cmd, origArguments: msg.Data}
			msg.parseOrigArguments()
			client.Send(msg)
		}
	}
	CachedLSMLock.RUnlock()
}

type timestampArray interface {
	Len() int
	GetTime(int) time.Time
}

// the CachedLSMLock must be held when calling this
func saveLastMessage(cmd Command, channel string, expires time.Time, data string, deleting bool) {
	chanMap, ok := CachedLastMessages[cmd]
	if !ok {
		if deleting {
			return
		}
		chanMap = make(map[string]LastSavedMessage)
		CachedLastMessages[cmd] = chanMap
	}

	if deleting {
		delete(chanMap, channel)
	} else {
		chanMap[channel] = LastSavedMessage{Expires: expires, Data: data}
	}
}

func HTTPBackendDropBacklog(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := Backend.secureForm.Unseal(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

	confirm := formData.Get("confirm")
	if confirm == "1" {
		DumpBacklogData()
	}
}

func rateLimitFromRequest(r *http.Request) (rate.Limiter, error) {
	if r.FormValue("rateCount") != "" {
		c, err := strconv.ParseInt(r.FormValue("rateCount"), 10, 32)
		if err != nil {
			return nil, errors.Wrap(err, "rateCount")
		}
		d, err := time.ParseDuration(r.FormValue("rateTime"))
		if err != nil {
			return nil, errors.Wrap(err, "rateTime")
		}
		return rate.NewRateLimit(int(c), d), nil
	}
	return rate.Unlimited(), nil
}

// HTTPBackendCachedPublish handles the /cached_pub route.
// It publishes a message to clients, and then updates the in-server cache for the message.
//
// The 'channel' parameter is a comma-separated list of topics to publish the message to.
// The 'args' parameter is the JSON-encoded command data.
// If the 'delete' parameter is present, an entry is removed from the cache instead of publishing a message.
// If the 'expires' parameter is not specified, the message will not expire (though it is only kept in-memory).
func HTTPBackendCachedPublish(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := Backend.secureForm.Unseal(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

	cmd := CommandPool.InternCommand(formData.Get("cmd"))
	json := formData.Get("args")
	channel := formData.Get("channel")
	deleteMode := formData.Get("delete") != ""
	timeStr := formData.Get("expires")
	var expires time.Time
	if timeStr != "" {
		timeNum, err := strconv.ParseInt(timeStr, 10, 64)
		if err != nil {
			w.WriteHeader(422)
			fmt.Fprintf(w, "error parsing time: %v", err)
			return
		}
		expires = time.Unix(timeNum, 0)
	}
	rl, err := rateLimitFromRequest(r)
	if err != nil {
		w.WriteHeader(422)
		fmt.Fprintf(w, "error parsing ratelimit: %v", err)
		return
	}

	var count int
	msg := ClientMessage{MessageID: -1, Command: cmd, origArguments: json}
	msg.parseOrigArguments()

	channels := strings.Split(channel, ",")
	CachedLSMLock.Lock()
	for _, channel := range channels {
		saveLastMessage(cmd, channel, expires, json, deleteMode)
	}
	CachedLSMLock.Unlock()

	var wg sync.WaitGroup
	wg.Add(1)
	go rl.Run()
	go func() {
		count = PublishToMultiple(channels, msg, rl)
		wg.Done()
		rl.Close()
	}()
	ch := make(chan struct{})
	go func() {
		wg.Wait()
		close(ch)
	}()
	select {
	case <-time.After(3 * time.Second):
		count = -1
	case <-ch:
	}
	w.Write([]byte(strconv.Itoa(count)))
}

// HTTPBackendUncachedPublish handles the /uncached_pub route.
// The backend can POST here to publish a message to clients with no caching.
// The POST arguments are `cmd`, `args`, `channel`, and `scope`.
// If "scope" is "global", then "channel" is not used.
func HTTPBackendUncachedPublish(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := Backend.secureForm.Unseal(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

	cmd := formData.Get("cmd")
	json := formData.Get("args")
	channel := formData.Get("channel")
	scope := formData.Get("scope")

	if cmd == "" {
		w.WriteHeader(422)
		fmt.Fprint(w, "Error: cmd cannot be blank")
		return
	}
	if channel == "" && scope != "global" {
		w.WriteHeader(422)
		fmt.Fprint(w, "Error: channel must be specified")
		return
	}
	rl, err := rateLimitFromRequest(r)
	if err != nil {
		w.WriteHeader(422)
		fmt.Fprintf(w, "error parsing ratelimit: %v", err)
		return
	}

	cm := ClientMessage{MessageID: -1, Command: CommandPool.InternCommand(cmd), origArguments: json}
	cm.parseOrigArguments()

	var count int
	var wg sync.WaitGroup
	wg.Add(1)
	go rl.Run()
	go func() {
		switch scope {
		default:
			count = PublishToMultiple(strings.Split(channel, ","), cm, rl)
		case "global":
			count = PublishToAll(cm, rl)
		}
		wg.Done()
		rl.Close()
	}()
	ch := make(chan struct{})
	go func() {
		wg.Wait()
		close(ch)
	}()
	select {
	case <-time.After(3 * time.Second):
		count = -1
	case <-ch:
	}
	w.Write([]byte(strconv.Itoa(count)))

}

// HTTPGetSubscriberCount handles the /get_sub_count route.
// It replies with the number of clients subscribed to a pub/sub topic.
// A "global" option is not available, use fetch(/stats).CurrentClientCount instead.
func HTTPGetSubscriberCount(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := Backend.secureForm.Unseal(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

	channel := formData.Get("channel")

	fmt.Fprint(w, CountSubscriptions(strings.Split(channel, ",")))
}
