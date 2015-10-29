package server

import (
	"encoding/json"
	"github.com/satori/go.uuid"
	"sync"
	"time"
)

const CryptoBoxKeyLength = 32

type ConfigFile struct {
	// Numeric server id known to the backend
	ServerId   int
	ListenAddr string
	// Hostname of the socket server
	SocketOrigin string
	// URL to the backend server
	BackendUrl string

	// SSL/TLS
	UseSSL             bool
	SSLCertificateFile string
	SSLKeyFile         string

	// Nacl keys
	OurPrivateKey    []byte
	OurPublicKey     []byte
	BackendPublicKey []byte
}

type ClientMessage struct {
	// Message ID. Increments by 1 for each message sent from the client.
	// When replying to a command, the message ID must be echoed.
	// When sending a server-initiated message, this is -1.
	MessageID int
	// The command that the client wants from the server.
	// When sent from the server, the literal string 'True' indicates success.
	// Before sending, a blank Command will be converted into SuccessCommand.
	Command Command
	// Result of json.Unmarshal on the third field send from the client
	Arguments interface{}

	origArguments string
}

type AuthInfo struct {
	// The client's claimed username on Twitch.
	TwitchUsername string

	// Whether or not the server has validated the client's claimed username.
	UsernameValidated bool
}

type ClientInfo struct {
	// The client ID.
	// This must be written once by the owning goroutine before the struct is passed off to any other goroutines.
	ClientID uuid.UUID

	// The client's version.
	// This must be written once by the owning goroutine before the struct is passed off to any other goroutines.
	Version string

	// This mutex protects writable data in this struct.
	// If it seems to be a performance problem, we can split this.
	Mutex sync.Mutex

	// TODO(riking) - does this need to be protected cross-thread?
	AuthInfo

	// Username validation nonce.
	ValidationNonce string

	// The list of chats this client is currently in.
	// Protected by Mutex.
	CurrentChannels []string

	// List of channels that we have not yet checked current chat-related channel info for.
	// This lets us batch the backlog requests.
	// Protected by Mutex.
	PendingSubscriptionsBacklog []string

	// A timer that, when fired, will make the pending backlog requests.
	// Usually nil. Protected by Mutex.
	MakePendingRequests *time.Timer

	// Server-initiated messages should be sent here
	// This field will be nil before it is closed.
	MessageChannel chan<- ClientMessage

	// Take a read-lock on this before checking whether MessageChannel is nil.
	MsgChannelKeepalive sync.RWMutex

	// The number of pings sent without a response
	pingCount int
}

type tgmarray []TimestampedGlobalMessage
type tmmarray []TimestampedMultichatMessage

func (ta tgmarray) Len() int {
	return len(ta)
}
func (ta tgmarray) Less(i, j int) bool {
	return ta[i].Timestamp.Before(ta[j].Timestamp)
}
func (ta tgmarray) Swap(i, j int) {
	ta[i], ta[j] = ta[j], ta[i]
}
func (ta tgmarray) GetTime(i int) time.Time {
	return ta[i].Timestamp
}
func (ta tmmarray) Len() int {
	return len(ta)
}
func (ta tmmarray) Less(i, j int) bool {
	return ta[i].Timestamp.Before(ta[j].Timestamp)
}
func (ta tmmarray) Swap(i, j int) {
	ta[i], ta[j] = ta[j], ta[i]
}
func (ta tmmarray) GetTime(i int) time.Time {
	return ta[i].Timestamp
}

func (bct BacklogCacheType) Name() string {
	switch bct {
	case CacheTypeInvalid:
		return ""
	case CacheTypeNever:
		return "never"
	case CacheTypeTimestamps:
		return "timed"
	case CacheTypeLastOnly:
		return "last"
	case CacheTypePersistent:
		return "persist"
	}
	panic("Invalid BacklogCacheType value")
}

var CacheTypesByName = map[string]BacklogCacheType{
	"never":   CacheTypeNever,
	"timed":   CacheTypeTimestamps,
	"last":    CacheTypeLastOnly,
	"persist": CacheTypePersistent,
}

func BacklogCacheTypeByName(name string) (bct BacklogCacheType) {
	// CacheTypeInvalid is the zero value so it doesn't matter
	bct, _ = CacheTypesByName[name]
	return
}

// Implements Stringer
func (bct BacklogCacheType) String() string { return bct.Name() }

// Implements json.Marshaler
func (bct BacklogCacheType) MarshalJSON() ([]byte, error) {
	return json.Marshal(bct.Name())
}

// Implements json.Unmarshaler
func (pbct *BacklogCacheType) UnmarshalJSON(data []byte) error {
	var str string
	err := json.Unmarshal(data, &str)
	if err != nil {
		return err
	}
	if str == "" {
		*pbct = CacheTypeInvalid
		return nil
	}
	val := BacklogCacheTypeByName(str)
	if val != CacheTypeInvalid {
		*pbct = val
		return nil
	}
	return ErrorUnrecognizedCacheType
}

func (mtt MessageTargetType) Name() string {
	switch mtt {
	case MsgTargetTypeInvalid:
		return ""
	case MsgTargetTypeSingle:
		return "single"
	case MsgTargetTypeChat:
		return "chat"
	case MsgTargetTypeMultichat:
		return "multichat"
	case MsgTargetTypeGlobal:
		return "global"
	}
	panic("Invalid MessageTargetType value")
}

var TargetTypesByName = map[string]MessageTargetType{
	"single":    MsgTargetTypeSingle,
	"chat":      MsgTargetTypeChat,
	"multichat": MsgTargetTypeMultichat,
	"global":    MsgTargetTypeGlobal,
}

func MessageTargetTypeByName(name string) (mtt MessageTargetType) {
	// MsgTargetTypeInvalid is the zero value so it doesn't matter
	mtt, _ = TargetTypesByName[name]
	return
}

// Implements Stringer
func (mtt MessageTargetType) String() string { return mtt.Name() }

// Implements json.Marshaler
func (mtt MessageTargetType) MarshalJSON() ([]byte, error) {
	return json.Marshal(mtt.Name())
}

// Implements json.Unmarshaler
func (pmtt *MessageTargetType) UnmarshalJSON(data []byte) error {
	var str string
	err := json.Unmarshal(data, &str)
	if err != nil {
		return err
	}
	if str == "" {
		*pmtt = MsgTargetTypeInvalid
		return nil
	}
	mtt := MessageTargetTypeByName(str)
	if mtt != MsgTargetTypeInvalid {
		*pmtt = mtt
		return nil
	}
	return ErrorUnrecognizedTargetType
}
