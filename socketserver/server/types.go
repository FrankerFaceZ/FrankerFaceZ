package server

import (
	"fmt"
	"net"
	"sync"

	"github.com/satori/go.uuid"
)

const NegativeOne = ^uint64(0)

var AnonymousClientID = uuid.FromStringOrNil("683b45e4-f853-4c45-bf96-7d799cc93e34")

type ConfigFile struct {
	// Numeric server id known to the backend
	ServerID int
	// Address to bind the HTTP server to on startup.
	ListenAddr string
	// Address to bind the TLS server to on startup.
	SSLListenAddr string
	// URL to the backend server
	BackendURL string

	// Minimum memory to accept a new connection
	MinMemoryKBytes uint64
	// Maximum # of clients that can be connected. 0 to disable.
	MaxClientCount uint64

	// SSL/TLS
	// Enable the use of SSL.
	UseSSL bool
	// Path to certificate file.
	SSLCertificateFile string
	// Path to key file.
	SSLKeyFile string

	// Nacl keys
	OurPrivateKey    []byte
	OurPublicKey     []byte
	BackendPublicKey []byte

	// Request username validation from all new clients.
	SendAuthToNewClients bool

	// Proxy Routes
	ProxyRoutes []ProxyRoute
}


type ProxyRoute struct {
	Route	string
	Server	string
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

func (cm ClientMessage) Reply(cmd Command, args interface{}) ClientMessage {
	return ClientMessage{
		MessageID: cm.MessageID,
		Command:   cmd,
		Arguments: args,
	}
}

func (cm ClientMessage) ReplyJSON(cmd Command, argsJSON string) ClientMessage {
	n := ClientMessage{
		MessageID:     cm.MessageID,
		Command:       cmd,
		origArguments: argsJSON,
	}
	return n
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

	// Set after a successful hello message.
	HelloOK bool

	// This mutex protects writable data in this struct.
	// If it seems to be a performance problem, we can split this.
	Mutex sync.Mutex

	// Info about the client's username and whether or not we have verified it.
	AuthInfo

	RemoteAddr net.Addr

	// Username validation nonce.
	ValidationNonce string

	// The list of chats this client is currently in.
	// Protected by Mutex.
	CurrentChannels []string

	// True if the client has already sent the 'ready' command
	ReadyComplete bool

	// Server-initiated messages should be sent via the Send() method.
	MessageChannel chan<- ClientMessage

	// Closed when the client is shutting down.
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
