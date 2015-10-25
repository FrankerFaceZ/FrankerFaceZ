package lib // import "bitbucket.org/stendec/frankerfacez/socketserver/lib"

import (
	"net/http"
	"golang.org/x/net/websocket"
	"crypto/tls"
	"log"
	"strings"
	"strconv"
	"errors"
	"encoding/json"
	"github.com/satori/go.uuid"
	"fmt"
	"sync"
)

const MAX_PACKET_SIZE = 1024

type Config struct {
	SSLCertificateFile string
	SSLKeyFile         string
	UseSSL             bool

	Origin             string
}

// A command is how the client refers to a function on the server. It's just a string.
type Command string

type ClientMessage struct {
	// Message ID. Increments by 1 for each message sent from the client.
	// When replying to a command, the message ID must be echoed.
	// When sending a server-initiated message, this is -1.
	MessageID int
	// The command that the client wants from the server.
	// When sent from the server, the literal string 'True' indicates success.
	// Before sending, a blank Command will be converted into SuccessCommand.
	Command   Command
	//
	Arguments interface{}
}

type ClientInfo struct {
	// The client ID.
	// This must be written once by the owning goroutine before the struct is passed off to any other goroutines.
	ClientID          uuid.UUID

	// The client's version.
	// This must be written once by the owning goroutine before the struct is passed off to any other goroutines.
	Version           string

	// This mutex protects writable data in this struct.
	// If it seems to be a performance problem, we can split this.
	Mutex             sync.Mutex

	// The client's claimed username on Twitch.
	TwitchUsername    string

	// Whether or not the server has validated the client's claimed username.
	UsernameValidated bool

	// The list of chats this client is currently in.
	// Protected by Mutex
	CurrentChannels   []string

	// Server-initiated messages should be sent here
	MessageChannel    chan <- ClientMessage
}

// A function that is called to respond to a Command.
type CommandHandler func(*websocket.Conn, *ClientInfo, ClientMessage) (ClientMessage, error)

var CommandHandlers = map[Command]CommandHandler{
	HelloCommand: HandleHello,
	"get_display_name": HandleGetDisplayName,
	"sub": HandleSub,
	"unsub": HandleUnsub,
	"chat_history": HandleChatHistory,
	"sub_channel": HandleSubChannel,
	"unsub_channel": HandleUnsubChannel,
	"setuser": HandleSetUser,
	"update_follow_buttons": HandleUpdateFollowButtons,
	"track_follow": HandleTrackFollow,
	"emoticon_uses": HandleEmoticonUses,
	"twitch_emote": HandleTwitchEmote,
	"get_link": HandleGetLink,
	"survey": HandleSurvey,
}

// Sent by the server in ClientMessage.Command to indicate success.
const SuccessCommand Command = "True"
const HelloCommand Command = "hello"

// A websocket.Codec that translates the protocol into ClientMessage objects.
var FFZCodec websocket.Codec = websocket.Codec{
	Marshal: MarshalClientMessage,
	Unmarshal: UnmarshalClientMessage,
}

// Errors that get returned to the client.
var ProtocolError error = errors.New("FFZ Socket protocol error.")
var ExpectedSingleString = errors.New("Error: Expected single string as arguments.")
var ExpectedTwoStrings = errors.New("Error: Expected array of string, string as arguments.")
var ExpectedStringAndInt = errors.New("Error: Expected array of string, int as arguments.")
var ExpectedStringAndIntGotFloat = errors.New("Error: Second argument was a float, expected an integer.")

// Create a websocket.Server with the options from the provided Config.
func SetupServer(config *Config) *websocket.Server {
	sockConf, err := websocket.NewConfig("/", config.Origin)
	if err != nil {
		panic(err)
	}
	if config.UseSSL {
		cert, err := tls.LoadX509KeyPair(config.SSLCertificateFile, config.SSLKeyFile)
		if err != nil {
			panic(err)
		}
		tlsConf := &tls.Config{
			Certificates: []tls.Certificate{cert},
			ServerName: config.Origin,
		}
		tlsConf.BuildNameToCertificate()
		sockConf.TlsConfig = tlsConf
	}

	sockServer := &websocket.Server{}
	sockServer.Config = *sockConf
	sockServer.Handler = HandleSocketConnection
	return sockServer
}

// Set up a websocket listener and register it on /.
// (Uses http.DefaultServeMux .)
func SetupServerAndHandle(config *Config) {
	sockServer := SetupServer(config)

	http.HandleFunc("/", sockServer.ServeHTTP)
}

// Handle a new websocket connection from a FFZ client.
// This runs in a goroutine started by net/http.
func HandleSocketConnection(conn *websocket.Conn) {
	// websocket.Conn is a ReadWriteCloser

	var _closer sync.Once
	closer := func() {
		_closer.Do(func() {
			conn.Close()
		})
	}

	defer func() {
		closer()
	}()

	log.Print("! Got a connection from ", conn.RemoteAddr())

	_clientChan := make(chan ClientMessage)
	_serverMessageChan := make(chan ClientMessage)
	_errorChan := make(chan error)

	// Receive goroutine
	go func(errorChan chan <- error, clientChan chan <- ClientMessage) {
		var msg ClientMessage
		var err error
		for ; err == nil; err = FFZCodec.Receive(conn, &msg) {
			if msg.MessageID == 0 {
				continue
			}
			clientChan <- msg
		}
		errorChan <- err
		close(errorChan)
		close(clientChan)
		// exit
	}(_errorChan, _clientChan)

	var client ClientInfo
	client.MessageChannel = _serverMessageChan

	var errorChan <-chan error = _errorChan
	var clientChan <-chan ClientMessage = _clientChan
	var serverMessageChan <-chan ClientMessage = _serverMessageChan

	RunLoop:
	for {
		select {
		case err := <-errorChan:
			FFZCodec.Send(conn, ClientMessage{
				MessageID: -1,
				Command: "error",
				Arguments: err.Error(),
			}) // note - socket might be closed, but don't care
			break RunLoop
		case msg := <-clientChan:
			if client.Version == "" && msg.Command != HelloCommand {
				FFZCodec.Send(conn, ClientMessage{
					MessageID: msg.MessageID,
					Command: "error",
					Arguments: "Error - the first message sent must be a 'hello'",
				})
				break RunLoop
			}

			handler, ok := CommandHandlers[msg.Command]
			if !ok {
				log.Print("[!] Unknown command", msg.Command, "- sent by client", client.ClientID, "@", conn.RemoteAddr())
				// uncomment after commands are implemented
				// closer()
				continue
			}

			log.Println(conn.RemoteAddr(), msg.MessageID, msg.Command, msg.Arguments)

			client.Mutex.Lock()
			response, err := CallHandler(handler, conn, &client, msg)
			client.Mutex.Unlock()

			if err == nil {
				response.MessageID = msg.MessageID
				FFZCodec.Send(conn, response)
			} else {
				FFZCodec.Send(conn, ClientMessage{
					MessageID: msg.MessageID,
					Command: "error",
					Arguments: err.Error(),
				})
			}
		case smsg := <-serverMessageChan:
			FFZCodec.Send(conn, smsg)
		}
	}
	// exit
}

func CallHandler(handler CommandHandler, conn *websocket.Conn, client *ClientInfo, cmsg ClientMessage) (rmsg ClientMessage, err error) {
	defer func() {
		if r := recover(); r != nil {
			var ok bool
			fmt.Print("[!] Error executing command", cmsg.Command, "--", r)
			err, ok = r.(error)
			if !ok {
				err = fmt.Errorf("command handler: %v", r)
			}
		}
	}()
	return handler(conn, client, cmsg)
}

// Unpack a message sent from the client into a ClientMessage.
func UnmarshalClientMessage(data []byte, payloadType byte, v interface{}) (err error) {
	var spaceIdx int

	out := v.(*ClientMessage)
	dataStr := string(data)

	// Message ID
	spaceIdx = strings.IndexRune(dataStr, ' ')
	if spaceIdx == -1 {
		return ProtocolError
	}
	messageId, err := strconv.Atoi(dataStr[:spaceIdx])
	if messageId <= 0 {
		return ProtocolError
	}

	out.MessageID = messageId
	dataStr = dataStr[spaceIdx + 1:]

	spaceIdx = strings.IndexRune(dataStr, ' ')
	if spaceIdx == -1 {
		out.Command = Command(dataStr)
		out.Arguments = nil
		return nil
	} else {
		out.Command = Command(dataStr[:spaceIdx])
	}
	dataStr = dataStr[spaceIdx + 1:]
	argumentsJson := dataStr
	err = json.Unmarshal([]byte(argumentsJson), &out.Arguments)
	if err != nil {
		return
	}
	return nil
}

func MarshalClientMessage(clientMessage interface{}) (data []byte, payloadType byte, err error) {
	var msg ClientMessage
	var ok bool
	msg, ok = clientMessage.(ClientMessage)
	if !ok {
		pMsg, ok := clientMessage.(*ClientMessage)
		if !ok {
			panic("MarshalClientMessage: argument needs to be a ClientMessage")
		}
		msg = *pMsg
	}
	var dataStr string

	if msg.Command == "" && msg.MessageID == 0 {
		panic("MarshalClientMessage: attempt to send an empty ClientMessage")
	}

	if msg.Command == "" {
		msg.Command = SuccessCommand
	}
	if msg.MessageID == 0 {
		msg.MessageID = -1
	}

	if msg.Arguments != nil {
		argBytes, err := json.Marshal(msg.Arguments)
		if err != nil {
			return nil, 0, err
		}

		dataStr = fmt.Sprintf("%d %s %s", msg.MessageID, msg.Command, string(argBytes))
	} else {
		dataStr = fmt.Sprintf("%d %s", msg.MessageID, msg.Command)
	}

	return []byte(dataStr), websocket.TextFrame, nil
}

// Command handlers should use this to construct responses.
func NewClientMessage(arguments interface{}) ClientMessage {
	return ClientMessage{
		MessageID: 0, // filled by the select loop
		Command: SuccessCommand,
		Arguments: arguments,
	}
}


// Convenience method: Parse the arguments of the ClientMessage as a single string.
func (cm *ClientMessage) ArgumentsAsString() (string1 string, err error) {
	var ok bool
	string1, ok = cm.Arguments.(string)
	if !ok {
		err = ExpectedSingleString; return
	} else {
		return string1, nil
	}
}

// Convenience method: Parse the arguments of the ClientMessage as an array of two strings.
func (cm *ClientMessage) ArgumentsAsTwoStrings() (string1, string2 string, err error) {
	var ok bool
	var ary []interface{}
	ary, ok = cm.Arguments.([]interface{})
	if !ok {
		err = ExpectedTwoStrings; return
	} else {
		if len(ary) != 2 {
			err = ExpectedTwoStrings; return
		}
		string1, ok = ary[0].(string)
		if !ok {
			err = ExpectedTwoStrings; return
		}
		string2, ok = ary[1].(string)
		if !ok {
			err = ExpectedTwoStrings; return
		}
		return string1, string2, nil
	}
}

// Convenience method: Parse the arguments of the ClientMessage as an array of a string and an int.
func (cm *ClientMessage) ArgumentsAsStringAndInt() (string1 string, int int64, err error) {
	var ok bool
	var ary []interface{}
	ary, ok = cm.Arguments.([]interface{})
	if !ok {
		err = ExpectedStringAndInt; return
	} else {
		if len(ary) != 2 {
			err = ExpectedStringAndInt; return
		}
		string1, ok = ary[0].(string)
		if !ok {
			err = ExpectedStringAndInt; return
		}
		var num float64
		num, ok = ary[1].(float64)
		if !ok {
			err = ExpectedStringAndInt; return
		}
		int = int64(num)
		if float64(int) != num {
			err = ExpectedStringAndIntGotFloat; return
		}
		return string1, int, nil
	}
}
