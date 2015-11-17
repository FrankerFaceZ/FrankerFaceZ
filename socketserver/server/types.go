package server

import (
	"encoding/json"
	"fmt"
	"github.com/satori/go.uuid"
	"net"
	"sync"
	"time"
)

const CryptoBoxKeyLength = 32

type ConfigFile struct {
	// Numeric server id known to the backend
	ServerID   int
	ListenAddr string
	// Hostname of the socket server
	SocketOrigin string
	// URL to the backend server
	BackendURL string

	// Minimum memory to accept a new connection
	MinMemoryKBytes uint64

	// SSL/TLS
	UseSSL             bool
	SSLCertificateFile string
	SSLKeyFile         string

	// Nacl keys
	OurPrivateKey    []byte
	OurPublicKey     []byte
	BackendPublicKey []byte

	SendAuthToNewClients bool
}

type ClientMessage struct {
	// Message ID. Increments by 1 for each message sent from the client.
	// When replying to a command, the message ID must be echoed.
	// When sending a server-initiated message, this is -1.
	MessageID int `json:"m"`
	// The command that the client wants from the server.
	// When sent from the server, the literal string 'True' indicates success.
	// Before sending, a blank Command will be converted into SuccessCommand.
	Command Command `json:"c"`
	// Result of json.Unmarshal on the third field send from the client
	Arguments interface{} `json:"a"`

	origArguments string
}

type AuthInfo struct {
	// The client's claimed username on Twitch.
	TwitchUsername string

	// Whether or not the server has validated the client's claimed username.
	UsernameValidated bool
}

type ClientVersion struct {
	Major    int
	Minor    int
	Revision int
}

type ClientInfo struct {
	// The client ID.
	// This must be written once by the owning goroutine before the struct is passed off to any other goroutines.
	ClientID uuid.UUID

	// The client's literal version string.
	// This must be written once by the owning goroutine before the struct is passed off to any other goroutines.
	VersionString string

	Version ClientVersion

	// This mutex protects writable data in this struct.
	// If it seems to be a performance problem, we can split this.
	Mutex sync.Mutex

	// TODO(riking) - does this need to be protected cross-thread?
	AuthInfo

	RemoteAddr net.Addr

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

	MsgChannelIsDone <-chan struct{}

	// Take out an Add() on this during a command if you need to use the MessageChannel later.
	MsgChannelKeepalive sync.WaitGroup

	// The number of pings sent without a response.
	// Protected by Mutex
	pingCount int
}

func VersionFromString(v string) ClientVersion {
	var cv ClientVersion
	fmt.Sscanf(v, "ffz_%d.%d.%d", &cv.Major, &cv.Minor, &cv.Revision)
	return cv
}

func (cv *ClientVersion) After(cv2 *ClientVersion) bool {
	if cv.Major > cv2.Major {
		return true
	} else if cv.Major < cv2.Major {
		return false
	}
	if cv.Minor > cv2.Minor {
		return true
	} else if cv.Minor < cv2.Minor {
		return false
	}
	if cv.Revision > cv2.Revision {
		return true
	} else if cv.Revision < cv2.Revision {
		return false
	}

	return false // equal
}

func (cv *ClientVersion) Equal(cv2 *ClientVersion) bool {
	return cv.Major == cv2.Major && cv.Minor == cv2.Minor && cv.Revision == cv2.Revision
}

const usePendingSubscrptionsBacklog = false

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
func (bct *BacklogCacheType) UnmarshalJSON(data []byte) error {
	var str string
	err := json.Unmarshal(data, &str)
	if err != nil {
		return err
	}
	if str == "" {
		*bct = CacheTypeInvalid
		return nil
	}
	newBct := BacklogCacheTypeByName(str)
	if newBct != CacheTypeInvalid {
		*bct = newBct
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
func (mtt *MessageTargetType) UnmarshalJSON(data []byte) error {
	var str string
	err := json.Unmarshal(data, &str)
	if err != nil {
		return err
	}
	if str == "" {
		*mtt = MsgTargetTypeInvalid
		return nil
	}
	newMtt := MessageTargetTypeByName(str)
	if newMtt != MsgTargetTypeInvalid {
		*mtt = newMtt
		return nil
	}
	return ErrorUnrecognizedTargetType
}
