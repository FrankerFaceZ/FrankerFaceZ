package server

import (
	"errors"
	"fmt"
	"net/http"
)

// this value is just docs right now
var ServerInitiatedCommands = []string{
	/// Global updates & notices
	"update_news", // timecache:global
	"message",     // timecache:global
	"reload_ff",   // timecache:global

	/// Emote updates
	"reload_badges", // timecache:global
	"set_badge",     // timecache:multichat
	"reload_set",    // timecache:multichat
	"load_set",      // TODO what are the semantics of this?

	/// User auth
	"do_authorize", // nocache:single

	/// Channel data
	// extra emote sets included in the chat
	"follow_sets", // mustcache:chat
	// extra follow buttons below the stream
	"follow_buttons", // mustcache:watching
	// SRL race data
	"srl_race", // cachelast:watching

	/// Chatter/viewer counts
	"chatters", // cachelast:watching
	"viewers",  // cachelast:watching
}
var _ = ServerInitiatedCommands

type BacklogCacheType int

const (
	// This is not a cache type.
	CacheTypeInvalid BacklogCacheType = iota
	// This message cannot be cached.
	CacheTypeNever
	// Save the last 24 hours of this message.
	// If a client indicates that it has reconnected, replay the messages sent after the disconnect.
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
	// This message is targeted to all users watching a stream
	MsgTargetTypeWatching
	// This message is sent to all FFZ users.
	MsgTargetTypeGlobal
)

// Returned by BacklogCacheType.UnmarshalJSON()
var ErrorUnrecognizedCacheType = errors.New("Invalid value for cachetype")

// Returned by MessageTargetType.UnmarshalJSON()
var ErrorUnrecognizedTargetType = errors.New("Invalid value for message target")

// note: see types.go for methods on these

func HBackendSaveBacklog(w http.ResponseWriter, r *http.Request) {
	formData, err := UnsealRequest(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

}
