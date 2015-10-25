package server

import (
	"github.com/satori/go.uuid"
	"sync"
	"time"
)

const CryptoBoxKeyLength = 32

type CryptoKeysBuf struct {
	OurPrivateKey []byte
	OurPublicKey []byte
	TheirPublicKey []byte
	ServerId int
}

type ClientMessage struct {
	// Message ID. Increments by 1 for each message sent from the client.
	// When replying to a command, the message ID must be echoed.
	// When sending a server-initiated message, this is -1.
	MessageID     int `json:_`
	// The command that the client wants from the server.
	// When sent from the server, the literal string 'True' indicates success.
	// Before sending, a blank Command will be converted into SuccessCommand.
	Command       Command `json:cmd`
	// Result of json.Unmarshal on the third field send from the client
	Arguments     interface{} `json:data`

	origArguments string
}

type AuthInfo struct {
	// The client's claimed username on Twitch.
	TwitchUsername    string

	// Whether or not the server has validated the client's claimed username.
	UsernameValidated bool
}

type ClientInfo struct {
	// The client ID.
	// This must be written once by the owning goroutine before the struct is passed off to any other goroutines.
	ClientID         uuid.UUID

	// The client's version.
	// This must be written once by the owning goroutine before the struct is passed off to any other goroutines.
	Version          string

	// This mutex protects writable data in this struct.
	// If it seems to be a performance problem, we can split this.
	Mutex            sync.Mutex

	// TODO(riking) - does this need to be protected cross-thread?
	AuthInfo

	// Username validation nonce.
	ValidationNonce  string

	// The list of chats this client is currently in.
	// Protected by Mutex.
	CurrentChannels  []string

	// This list of channels this client needs UI updates for.
	// Protected by Mutex.
	WatchingChannels []string

	// List of channels that we have not yet checked current chat-related channel info for.
	// This lets us batch the backlog requests.
	// Protected by Mutex.
	PendingChatBacklogs []string

	// List of channels that we have not yet checked current stream-related channel info for.
	// This lets us batch the backlog requests.
	// Protected by Mutex.
	PendingStreamBacklogs []string

	// A timer that, when fired, will make the pending backlog requests.
	// Usually nil. Protected by Mutex.
	MakePendingRequests *time.Timer

	// Server-initiated messages should be sent here
	// Never nil.
	MessageChannel   chan <- ClientMessage
}
