package server

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type LastSavedMessage struct {
	Timestamp time.Time
	Data      string
}

// map is command -> channel -> data

// CachedLastMessages is of CacheTypeLastOnly.
// Not actually cleaned up by reaper goroutine every ~hour.
var CachedLastMessages = make(map[Command]map[string]LastSavedMessage)
var CachedLSMLock sync.RWMutex

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
				client.MessageChannel <- msg
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
			client.MessageChannel <- msg
		}
	}
	CachedLSMLock.RUnlock()
}

type timestampArray interface {
	Len() int
	GetTime(int) time.Time
}

func SaveLastMessage(which map[Command]map[string]LastSavedMessage, locker sync.Locker, cmd Command, channel string, timestamp time.Time, data string, deleting bool) {
	locker.Lock()
	defer locker.Unlock()

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
		chanMap[channel] = LastSavedMessage{Timestamp: timestamp, Data: data}
	}
}

func HTTPBackendDropBacklog(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := Backend.UnsealRequest(r.Form)
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

// HTTPBackendCachedPublish handles the /cached_pub route.
// It publishes a message to clients, and then updates the in-server cache for the message.
// notes:
// `scope` is implicit in the command
func HTTPBackendCachedPublish(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := Backend.UnsealRequest(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

	cmd := CommandPool.InternCommand(formData.Get("cmd"))
	json := formData.Get("args")
	channel := formData.Get("channel")
	deleteMode := formData.Get("delete") != ""
	timeStr := formData.Get("time")
	timeNum, err := strconv.ParseInt(timeStr, 10, 64)
	if err != nil {
		w.WriteHeader(422)
		fmt.Fprintf(w, "error parsing time: %v", err)
		return
	}
	timestamp := time.Unix(timeNum, 0)

	var count int
	msg := ClientMessage{MessageID: -1, Command: cmd, origArguments: json}
	msg.parseOrigArguments()

	channels := strings.Split(channel, ",")
	var dummyLock sync.Mutex
	CachedLSMLock.Lock()
	for _, channel := range channels {
		SaveLastMessage(CachedLastMessages, &dummyLock, cmd, channel, timestamp, json, deleteMode)
	}
	CachedLSMLock.Unlock()
	count = PublishToMultiple(channels, msg)

	w.Write([]byte(strconv.Itoa(count)))
}
