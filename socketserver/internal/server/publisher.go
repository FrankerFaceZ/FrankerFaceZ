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

// this value is just docs right now
var ServerInitiatedCommands = map[Command]PushCommandCacheInfo{
	/// Global updates & notices
	"update_news": {CacheTypeTimestamps, MsgTargetTypeGlobal}, // timecache:global
	"message":     {CacheTypeTimestamps, MsgTargetTypeGlobal}, // timecache:global
	"reload_ff":   {CacheTypeTimestamps, MsgTargetTypeGlobal}, // timecache:global

	/// Emote updates
	"reload_badges": {CacheTypeTimestamps, MsgTargetTypeGlobal},    // timecache:global
	"set_badge":     {CacheTypeTimestamps, MsgTargetTypeMultichat}, // timecache:multichat
	"reload_set":    {},                                            // timecache:multichat
	"load_set":      {},                                            // TODO what are the semantics of this?

	/// User auth
	"do_authorize": {CacheTypeNever, MsgTargetTypeSingle}, // nocache:single

	/// Channel data
	// follow_sets: extra emote sets included in the chat
	// follow_buttons: extra follow buttons below the stream
	"follow_sets":    {CacheTypePersistent, MsgTargetTypeChat}, // mustcache:chat
	"follow_buttons": {CacheTypePersistent, MsgTargetTypeChat}, // mustcache:watching
	"srl_race":       {CacheTypeLastOnly, MsgTargetTypeChat},   // cachelast:watching

	/// Chatter/viewer counts
	"chatters": {CacheTypeLastOnly, MsgTargetTypeChat}, // cachelast:watching
	"viewers":  {CacheTypeLastOnly, MsgTargetTypeChat}, // cachelast:watching
}

type BacklogCacheType int

const (
	// This is not a cache type.
	CacheTypeInvalid BacklogCacheType = iota
	// This message cannot be cached.
	CacheTypeNever
	// Save the last 24 hours of this message.
	// If a client indicates that it has reconnected, replay the messages sent after the disconnect.
	// Do not replay if the client indicates that this is a firstload.
	CacheTypeTimestamps
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
	// This message is targeted to a single TODO(user or connection)
	MsgTargetTypeSingle
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

type TimestampedGlobalMessage struct {
	Timestamp time.Time
	Command   Command
	Data      string
}

type TimestampedMultichatMessage struct {
	Timestamp time.Time
	Channels  []string
	Command   Command
	Data      string
}

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

var CachedGlobalMessages []TimestampedGlobalMessage
var CachedChannelMessages []TimestampedMultichatMessage
var CacheListsLock sync.RWMutex

// DumpBacklogData drops all /cached_pub data.
func DumpBacklogData() {
	CachedLSMLock.Lock()
	CachedLastMessages = make(map[Command]map[string]LastSavedMessage)
	CachedLSMLock.Unlock()

	PersistentLSMLock.Lock()
	PersistentLastMessages = make(map[Command]map[string]LastSavedMessage)
	PersistentLSMLock.Unlock()

	CacheListsLock.Lock()
	CachedGlobalMessages = make(tgmarray, 0)
	CachedChannelMessages = make(tmmarray, 0)
	CacheListsLock.Unlock()
}

// SendBacklogForNewClient sends any backlog data relevant to a new client.
// This should be done when the client sends a `ready` message.
// This will only send data for CacheTypePersistent and CacheTypeLastOnly because those do not involve timestamps.
func SendBacklogForNewClient(client *ClientInfo) {
	client.Mutex.Lock() // reading CurrentChannels
	PersistentLSMLock.RLock()
	for _, cmd := range GetCommandsOfType(PushCommandCacheInfo{CacheTypePersistent, MsgTargetTypeChat}) {
		chanMap := CachedLastMessages[cmd]
		if chanMap == nil {
			continue
		}
		for _, channel := range client.CurrentChannels {
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
		for _, channel := range client.CurrentChannels {
			msg, ok := chanMap[channel]
			if ok {
				msg := ClientMessage{MessageID: -1, Command: cmd, origArguments: msg.Data}
				msg.parseOrigArguments()
				client.MessageChannel <- msg
			}
		}
	}
	CachedLSMLock.RUnlock()
	client.Mutex.Unlock()
}

// SendTimedBacklogMessages sends any once-off messages that the client may have missed while it was disconnected.
// Effectively, this can only process CacheTypeTimestamps.
func SendTimedBacklogMessages(client *ClientInfo, disconnectTime time.Time) {
	client.Mutex.Lock() // reading CurrentChannels
	CacheListsLock.RLock()

	globIdx := findFirstNewMessage(tgmarray(CachedGlobalMessages), disconnectTime)

	if globIdx != -1 {
		for i := globIdx; i < len(CachedGlobalMessages); i++ {
			item := CachedGlobalMessages[i]
			msg := ClientMessage{MessageID: -1, Command: item.Command, origArguments: item.Data}
			msg.parseOrigArguments()
			client.MessageChannel <- msg
		}
	}

	chanIdx := findFirstNewMessage(tmmarray(CachedChannelMessages), disconnectTime)

	if chanIdx != -1 {
		for i := chanIdx; i < len(CachedChannelMessages); i++ {
			item := CachedChannelMessages[i]
			var send bool
			for _, channel := range item.Channels {
				for _, matchChannel := range client.CurrentChannels {
					if channel == matchChannel {
						send = true
						break
					}
				}
				if send {
					break
				}
			}
			if send {
				msg := ClientMessage{MessageID: -1, Command: item.Command, origArguments: item.Data}
				msg.parseOrigArguments()
				client.MessageChannel <- msg
			}
		}
	}

	CacheListsLock.RUnlock()
	client.Mutex.Unlock()
}

func backlogJanitor() {
	for {
		time.Sleep(1 * time.Hour)
		cleanupTimedBacklogMessages()
	}
}

func cleanupTimedBacklogMessages() {
	CacheListsLock.Lock()
	oneHourAgo := time.Now().Add(-24 * time.Hour)
	globIdx := findFirstNewMessage(tgmarray(CachedGlobalMessages), oneHourAgo)
	if globIdx != -1 {
		newGlobMsgs := make([]TimestampedGlobalMessage, len(CachedGlobalMessages)-globIdx)
		copy(newGlobMsgs, CachedGlobalMessages[globIdx:])
		CachedGlobalMessages = newGlobMsgs
	}
	chanIdx := findFirstNewMessage(tmmarray(CachedChannelMessages), oneHourAgo)
	if chanIdx != -1 {
		newChanMsgs := make([]TimestampedMultichatMessage, len(CachedChannelMessages)-chanIdx)
		copy(newChanMsgs, CachedChannelMessages[chanIdx:])
		CachedChannelMessages = newChanMsgs
	}
	CacheListsLock.Unlock()
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

func SaveGlobalMessage(cmd Command, timestamp time.Time, data string) {
	CacheListsLock.Lock()
	CachedGlobalMessages = append(CachedGlobalMessages, TimestampedGlobalMessage{timestamp, cmd, data})
	insertionSort(tgmarray(CachedGlobalMessages))
	CacheListsLock.Unlock()
}

func SaveMultichanMessage(cmd Command, channels string, timestamp time.Time, data string) {
	CacheListsLock.Lock()
	CachedChannelMessages = append(CachedChannelMessages, TimestampedMultichatMessage{timestamp, strings.Split(channels, ","), cmd, data})
	insertionSort(tmmarray(CachedChannelMessages))
	CacheListsLock.Unlock()
}

func GetCommandsOfType(match PushCommandCacheInfo) []Command {
	var ret []Command
	for cmd, info := range ServerInitiatedCommands {
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

	cacheinfo, ok := ServerInitiatedCommands[cmd]
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
	} else if cacheinfo.Caching == CacheTypeTimestamps && cacheinfo.Target == MsgTargetTypeMultichat {
		SaveMultichanMessage(cmd, channel, timestamp, json)
		count = PublishToMultiple(strings.Split(channel, ","), msg)
	} else if cacheinfo.Caching == CacheTypeTimestamps && cacheinfo.Target == MsgTargetTypeGlobal {
		SaveGlobalMessage(cmd, timestamp, json)
		count = PublishToAll(msg)
	}

	w.Write([]byte(strconv.Itoa(count)))
}
