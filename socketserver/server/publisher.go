package server

import (
	"errors"
	"fmt"
	"net/http"
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
	"srl_race":       {CacheTypeLastOnly, MsgTargetTypeMultichat},

	/// Chatter/viewer counts
	"chatters": {CacheTypeLastOnly, MsgTargetTypeChat},
	"viewers":  {CacheTypeLastOnly, MsgTargetTypeChat},
}

var PersistentCachingCommands = []Command{"follow_sets", "follow_buttons"}
var HourlyCachingCommands = []Command{"srl_race", "chatters", "viewers"}

type BacklogCacheType int

const (
	// CacheTypeInvalid is the sentinel value.
	CacheTypeInvalid BacklogCacheType = iota
	// CacheTypeNever is a message that cannot be cached.
	CacheTypeNever
	// CacheTypeLastOnly means to save only the last copy of this message,
	// and always send it when the backlog is requested.
	CacheTypeLastOnly
	// CacheTypePersistent means to save the last copy of this message,
	// and always send it when the backlog is requested, but do not clean it periodically.
	CacheTypePersistent
)

type MessageTargetType int

const (
	// MsgTargetTypeInvalid is the sentinel value.
	MsgTargetTypeInvalid MessageTargetType = iota
	// MsgTargetTypeChat is a message is targeted to all users in a particular chat.
	MsgTargetTypeChat
	// MsgTargetTypeMultichat is a message is targeted to all users in multiple chats.
	MsgTargetTypeMultichat
	// MsgTargetTypeGlobal is a message sent to all FFZ users.
	MsgTargetTypeGlobal
)

// note: see types.go for methods on these

// ErrorUnrecognizedCacheType is returned by BacklogCacheType.UnmarshalJSON()
var ErrorUnrecognizedCacheType = errors.New("Invalid value for cachetype")

// ErrorUnrecognizedTargetType is returned by MessageTargetType.UnmarshalJSON()
var ErrorUnrecognizedTargetType = errors.New("Invalid value for message target")

type LastSavedMessage struct {
	Timestamp time.Time
	Data      string
}

// map is command -> channel -> data

// CachedLastMessages is of CacheTypeLastOnly. Cleaned up by reaper goroutine every ~hour.
var CachedLastMessages = make(map[Command]map[string]LastSavedMessage)
var CachedLSMLock sync.RWMutex

// PersistentLastMessages is of CacheTypePersistent. Never cleaned.
var PersistentLastMessages = make(map[Command]map[string]LastSavedMessage)
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
	for _, cmd := range GetCommandsOfType(CacheTypePersistent) {
		chanMap := PersistentLastMessages[cmd]
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
	for _, cmd := range GetCommandsOfType(CacheTypeLastOnly) {
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

func SendBacklogForChannel(client *ClientInfo, channel string) {
	PersistentLSMLock.RLock()
	for _, cmd := range GetCommandsOfType(CacheTypePersistent) {
		chanMap := PersistentLastMessages[cmd]
		if chanMap == nil {
			continue
		}
		if msg, ok := chanMap[channel]; ok {
			msg := ClientMessage{MessageID: -1, Command: cmd, origArguments: msg.Data}
			msg.parseOrigArguments()
			client.MessageChannel <- msg
		}
	}
	PersistentLSMLock.RUnlock()

	CachedLSMLock.RLock()
	for _, cmd := range GetCommandsOfType(CacheTypeLastOnly) {
		chanMap := CachedLastMessages[cmd]
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

	chanMap, ok := which[cmd]
	if !ok {
		if deleting {
			return
		}
		chanMap = make(map[string]LastSavedMessage)
		which[cmd] = chanMap
	}

	if deleting {
		delete(chanMap, channel)
	} else {
		chanMap[channel] = LastSavedMessage{Timestamp: timestamp, Data: data}
	}
}

func GetCommandsOfType(match BacklogCacheType) []Command {
	if match == CacheTypePersistent {
		return PersistentCachingCommands
	} else if match == CacheTypeLastOnly {
		return HourlyCachingCommands
	} else {
		panic("unknown caching type")
	}
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

// HTTPBackendCachedPublish handles the /cached_pub route.
// It publishes a message to clients, and then updates the in-server cache for the message.
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
		var dummyLock sync.Mutex
		CachedLSMLock.Lock()
		for _, channel := range channels {
			SaveLastMessage(CachedLastMessages, &dummyLock, cmd, channel, timestamp, json, deleteMode)
		}
		CachedLSMLock.Unlock()
		count = PublishToMultiple(channels, msg)
	}

	w.Write([]byte(strconv.Itoa(count)))
}
