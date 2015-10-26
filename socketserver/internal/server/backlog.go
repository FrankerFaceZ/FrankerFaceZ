package server

import (
	"errors"
	"fmt"
	"net/http"
	"time"
)

type PushCommandCacheInfo struct {
	Caching BacklogCacheType
	Target  MessageTargetType
}

// this value is just docs right now
var ServerInitiatedCommands = map[string]PushCommandCacheInfo{
	/// Global updates & notices
	"update_news": {CacheTypeTimestamps, MsgTargetTypeGlobal}, // timecache:global
	"message":     {CacheTypeTimestamps, MsgTargetTypeGlobal}, // timecache:global
	"reload_ff":   {CacheTypeTimestamps, MsgTargetTypeGlobal}, // timecache:global

	/// Emote updates
	"reload_badges": {CacheTypeTimestamps, MsgTargetTypeGlobal},    // timecache:global
	"set_badge":     {CacheTypeTimestamps, MsgTargetTypeMultichat}, // timecache:multichat
	"reload_set":    {}, // timecache:multichat
	"load_set":      {},                                            // TODO what are the semantics of this?

	/// User auth
	"do_authorize": {CacheTypeNever, MsgTargetTypeSingle}, // nocache:single

	/// Channel data
	// follow_sets: extra emote sets included in the chat
	// follow_buttons: extra follow buttons below the stream
	"follow_sets":    {CacheTypePersistent, MsgTargetTypeChat},     // mustcache:chat
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

type PersistentCachedMessage struct {
	Timestamp time.Time
	Channel   string
	Watching  bool
	Data      string
}

type TimestampedGlobalMessage struct {
	Timestamp time.Time
	Data string
}

type TimestampedMultichatMessage struct {
	Timestamp time.Time
	Channels string
	Data string
}

type LastSavedMessage struct {
	Timestamp time.Time
	Data string
}

// map command -> channel -> data
var CachedDataLast map[Command]map[string]string

func DumpCache() {
	CachedDataLast = make(map[Command]map[string]string)
}

func HBackendDumpCache(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := UnsealRequest(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

	confirm := formData.Get("confirm")
	if confirm == "1" {
		DumpCache()
	}
}

// Publish a message to clients, and update the in-server cache for the message.
// notes:
// `scope` is implicit in the command
func HBackendUpdateAndPublish(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := UnsealRequest(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

	cmd := formData.Get("cmd")
	json := formData.Get("args")
	channel := formData.Get("channel")

	cacheinfo, ok := ServerInitiatedCommands[cmd]
	if !ok {
		w.WriteHeader(422)
		fmt.Fprintf(w, "Caching semantics unknown for command '%s'. Post to /addcachedcommand first.")
		return
	}

	_ = cacheinfo
	_ = json
	_ = channel
}
