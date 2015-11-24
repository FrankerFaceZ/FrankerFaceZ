package server

import (
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type PushCommandCacheInfo struct {
	Caching BacklogCacheType
	Target  MessageTargetType
}

// S2CCommandsCacheInfo details what the behavior is of each command that can be sent to /cached_pub.
var S2CCommandsCacheInfo = map[Command]PushCommandCacheInfo{
	/// Channel data
	// follow_sets: extra emote sets included in the chat
	// follow_buttons: extra follow buttons below the stream
	"follow_sets":    {CacheTypePersistent, MsgTargetTypeChat},
	"follow_buttons": {CacheTypePersistent, MsgTargetTypeChat},
	"srl_race":       {CacheTypeLastOnly, MsgTargetTypeChat},

	/// Chatter/viewer counts
	"chatters": {CacheTypeLastOnly, MsgTargetTypeChat},
	"viewers":  {CacheTypeLastOnly, MsgTargetTypeChat},
}

type BacklogCacheType int

const (
	// This is not a cache type.
	CacheTypeInvalid BacklogCacheType = iota
	// This message cannot be cached.
	CacheTypeNever
	// Save only the last copy of this message, and always send it when the backlog is requested.
	CacheTypeLastOnly
	// Save this backlog data to disk with its timestamp.
	// Send it when the backlog is requested, or after a reconnect if it was updated.
	CacheTypePersistent
)

type MessageTargetType int

const (
	// This is not a message target.
	MsgTargetTypeInvalid MessageTargetType = iota
	// This message is targeted to all users in a chat
	MsgTargetTypeChat
	// This message is targeted to all users in multiple chats
	MsgTargetTypeMultichat
	// This message is sent to all FFZ users.
	MsgTargetTypeGlobal
)

// note: see types.go for methods on these

// Returned by BacklogCacheType.UnmarshalJSON()
var ErrorUnrecognizedCacheType = errors.New("Invalid value for cachetype")

// Returned by MessageTargetType.UnmarshalJSON()
var ErrorUnrecognizedTargetType = errors.New("Invalid value for message target")

type LastSavedMessage struct {
	Timestamp time.Time
	Data      string
}

// map is command -> channel -> data

// CacheTypeLastOnly. Cleaned up by reaper goroutine every ~hour.
var CachedLastMessages map[Command]map[string]LastSavedMessage
var CachedLSMLock sync.RWMutex

// CacheTypePersistent. Never cleaned.
var PersistentLastMessages map[Command]map[string]LastSavedMessage
var PersistentLSMLock sync.RWMutex

// DumpBacklogData drops all /cached_pub data.
func DumpBacklogData() {
	CachedLSMLock.Lock()
	CachedLastMessages = make(map[Command]map[string]LastSavedMessage)
	CachedLSMLock.Unlock()

	PersistentLSMLock.Lock()
	PersistentLastMessages = make(map[Command]map[string]LastSavedMessage)
	PersistentLSMLock.Unlock()
}

// SendBacklogForNewClient sends any backlog data relevant to a new client.
// This should be done when the client sends a `ready` message.
// This will only send data for CacheTypePersistent and CacheTypeLastOnly because those do not involve timestamps.
func SendBacklogForNewClient(client *ClientInfo) {
	client.Mutex.Lock() // reading CurrentChannels
	curChannels := make([]string, len(client.CurrentChannels))
	copy(curChannels, client.CurrentChannels)
	client.Mutex.Unlock()

	PersistentLSMLock.RLock()
	for _, cmd := range GetCommandsOfType(PushCommandCacheInfo{CacheTypePersistent, MsgTargetTypeChat}) {
		chanMap := CachedLastMessages[cmd]
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
	PersistentLSMLock.RUnlock()

	CachedLSMLock.RLock()
	for _, cmd := range GetCommandsOfType(PushCommandCacheInfo{CacheTypeLastOnly, MsgTargetTypeChat}) {
		chanMap := CachedLastMessages[cmd]
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

// insertionSort implements insertion sort.
// CacheTypeTimestamps should use insertion sort for O(N) average performance.
// (The average case is the array is still sorted after insertion of the new item.)
func insertionSort(ary sort.Interface) {
	for i := 1; i < ary.Len(); i++ {
		for j := i; j > 0 && ary.Less(j, j-1); j-- {
			ary.Swap(j, j-1)
		}
	}
}

type timestampArray interface {
	Len() int
	GetTime(int) time.Time
}

func findFirstNewMessage(ary timestampArray, disconnectTime time.Time) (idx int) {
	len := ary.Len()
	i := len

	// Walk backwards until we find GetTime() before disconnectTime
	step := 1
	for i > 0 {
		i -= step
		if i < 0 {
			i = 0
		}
		if !ary.GetTime(i).After(disconnectTime) {
			break
		}
		step = int(float64(step)*1.5) + 1
	}

	// Walk forwards until we find GetTime() after disconnectTime
	for i < len && !ary.GetTime(i).After(disconnectTime) {
		i++
	}

	if i == len {
		return -1
	}
	return i
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
		chanMap[channel] = LastSavedMessage{timestamp, data}
	}
}

func GetCommandsOfType(match PushCommandCacheInfo) []Command {
	var ret []Command
	for cmd, info := range S2CCommandsCacheInfo {
		if info == match {
			ret = append(ret, cmd)
		}
	}
	return ret
}

func HTTPBackendDropBacklog(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := UnsealRequest(r.Form)
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

// Publish a message to clients, and update the in-server cache for the message.
// notes:
// `scope` is implicit in the command
func HTTPBackendCachedPublish(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := UnsealRequest(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

	cmd := Command(formData.Get("cmd"))
	json := formData.Get("args")
	channel := formData.Get("channel")
	deleteMode := formData.Get("delete") != ""
	timeStr := formData.Get("time")
	timestamp, err := time.Parse(time.UnixDate, timeStr)
	if err != nil {
		w.WriteHeader(422)
		fmt.Fprintf(w, "error parsing time: %v", err)
	}

	cacheinfo, ok := S2CCommandsCacheInfo[cmd]
	if !ok {
		w.WriteHeader(422)
		fmt.Fprintf(w, "Caching semantics unknown for command '%s'. Post to /addcachedcommand first.", cmd)
		return
	}

	var count int
	msg := ClientMessage{MessageID: -1, Command: cmd, origArguments: json}
	msg.parseOrigArguments()

	if cacheinfo.Caching == CacheTypeLastOnly && cacheinfo.Target == MsgTargetTypeChat {
		SaveLastMessage(CachedLastMessages, &CachedLSMLock, cmd, channel, timestamp, json, deleteMode)
		count = PublishToChannel(channel, msg)
	} else if cacheinfo.Caching == CacheTypePersistent && cacheinfo.Target == MsgTargetTypeChat {
		SaveLastMessage(PersistentLastMessages, &PersistentLSMLock, cmd, channel, timestamp, json, deleteMode)
		count = PublishToChannel(channel, msg)
	} else if cacheinfo.Caching == CacheTypeLastOnly && cacheinfo.Target == MsgTargetTypeMultichat {
		channels := strings.Split(channel, ",")
		for _, channel := range channels {
			SaveLastMessage(CachedLastMessages, &CachedLSMLock, cmd, channel, timestamp, json, deleteMode)
		}
		count = PublishToMultiple(channels, msg)
	}

	w.Write([]byte(strconv.Itoa(count)))
}
