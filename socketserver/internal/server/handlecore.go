package server // import "bitbucket.org/stendec/frankerfacez/socketserver/internal/server"

import (
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"golang.org/x/net/websocket"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

const MAX_PACKET_SIZE = 1024

type Config struct {
	// SSL/TLS
	SSLCertificateFile string
	SSLKeyFile         string
	UseSSL             bool

	// NaCl keys for backend messages
	NaclKeysFile string

	// Hostname of the socket server
	SocketOrigin string
	// URL to the backend server
	BackendUrl string
}

// A command is how the client refers to a function on the server. It's just a string.
type Command string

// A function that is called to respond to a Command.
type CommandHandler func(*websocket.Conn, *ClientInfo, ClientMessage) (ClientMessage, error)

var CommandHandlers = map[Command]CommandHandler{
	HelloCommand: HandleHello,
	"setuser":    HandleSetUser,

	"sub":           HandleSub,
	"unsub":         HandleUnsub,
	"sub_channel":   HandleSubChannel,
	"unsub_channel": HandleUnsubChannel,

	"track_follow":  HandleTrackFollow,
	"emoticon_uses": HandleEmoticonUses,
	"survey":        HandleSurvey,

	"twitch_emote":          HandleRemoteCommand,
	"get_link":              HandleRemoteCommand,
	"get_display_name":      HandleRemoteCommand,
	"update_follow_buttons": HandleRemoteCommand,
	"chat_history":          HandleRemoteCommand,
}

// Sent by the server in ClientMessage.Command to indicate success.
const SuccessCommand Command = "True"

// Sent by the server in ClientMessage.Command to indicate failure.
const ErrorCommand Command = "error"

// This must be the first command sent by the client once the connection is established.
const HelloCommand Command = "hello"

// A handler returning a ClientMessage with this Command will prevent replying to the client.
// It signals that the work has been handed off to a background goroutine.
const AsyncResponseCommand Command = "_async"

// A websocket.Codec that translates the protocol into ClientMessage objects.
var FFZCodec websocket.Codec = websocket.Codec{
	Marshal:   MarshalClientMessage,
	Unmarshal: UnmarshalClientMessage,
}

// Errors that get returned to the client.
var ProtocolError error = errors.New("FFZ Socket protocol error.")
var ProtocolErrorNegativeID error = errors.New("FFZ Socket protocol error: negative or zero message ID.")
var ExpectedSingleString = errors.New("Error: Expected single string as arguments.")
var ExpectedSingleInt = errors.New("Error: Expected single integer as arguments.")
var ExpectedTwoStrings = errors.New("Error: Expected array of string, string as arguments.")
var ExpectedStringAndInt = errors.New("Error: Expected array of string, int as arguments.")
var ExpectedStringAndBool = errors.New("Error: Expected array of string, bool as arguments.")
var ExpectedStringAndIntGotFloat = errors.New("Error: Second argument was a float, expected an integer.")

var gconfig *Config

// Create a websocket.Server with the options from the provided Config.
func setupServer(config *Config, tlsConfig *tls.Config) *websocket.Server {
	gconfig = config
	sockConf, err := websocket.NewConfig("/", config.SocketOrigin)
	if err != nil {
		log.Fatal(err)
	}

	SetupBackend(config)

	if config.UseSSL {
		cert, err := tls.LoadX509KeyPair(config.SSLCertificateFile, config.SSLKeyFile)
		if err != nil {
			log.Fatal(err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
		tlsConfig.ServerName = config.SocketOrigin
		tlsConfig.BuildNameToCertificate()
		sockConf.TlsConfig = tlsConfig

	}

	sockServer := &websocket.Server{}
	sockServer.Config = *sockConf
	sockServer.Handler = HandleSocketConnection

	go deadChannelReaper()

	return sockServer
}

// Set up a websocket listener and register it on /.
// (Uses http.DefaultServeMux .)
func SetupServerAndHandle(config *Config, tlsConfig *tls.Config, serveMux *http.ServeMux) {
	sockServer := setupServer(config, tlsConfig)

	if serveMux == nil {
		serveMux = http.DefaultServeMux
	}
	serveMux.HandleFunc("/", sockServer.ServeHTTP)
	serveMux.HandleFunc("/pub_msg", HBackendPublishRequest)
	serveMux.HandleFunc("/update_and_pub", HBackendUpdateAndPublish)
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

	// Close the connection when we're done.
	defer closer()

	_clientChan := make(chan ClientMessage)
	_serverMessageChan := make(chan ClientMessage)
	_errorChan := make(chan error)

	// Launch receiver goroutine
	go func(errorChan chan<- error, clientChan chan<- ClientMessage) {
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

	var errorChan <-chan error = _errorChan
	var clientChan <-chan ClientMessage = _clientChan
	var serverMessageChan <-chan ClientMessage = _serverMessageChan

	var client ClientInfo
	client.MessageChannel = _serverMessageChan

	// All set up, now enter the work loop

RunLoop:
	for {
		select {
		case err := <-errorChan:
			FFZCodec.Send(conn, ClientMessage{
				MessageID: -1,
				Command:   "error",
				Arguments: err.Error(),
			}) // note - socket might be closed, but don't care
			break RunLoop
		case msg := <-clientChan:
			if client.Version == "" && msg.Command != HelloCommand {
				FFZCodec.Send(conn, ClientMessage{
					MessageID: msg.MessageID,
					Command:   "error",
					Arguments: "Error - the first message sent must be a 'hello'",
				})
				break RunLoop
			}

			HandleCommand(conn, &client, msg)
		case smsg := <-serverMessageChan:
			FFZCodec.Send(conn, smsg)
		}
	}

	// Exit

	// Launch message draining goroutine - we aren't out of the pub/sub records
	go func() {
		for _ = range _serverMessageChan {
		}
	}()

	// Stop getting messages...
	UnsubscribeAll(&client)

	// And finished.
	// Close the channel so the draining goroutine can finish, too.
	close(_serverMessageChan)
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
	if messageId < -1 || messageId == 0 {
		return ProtocolErrorNegativeID
	}

	out.MessageID = messageId
	dataStr = dataStr[spaceIdx+1:]

	spaceIdx = strings.IndexRune(dataStr, ' ')
	if spaceIdx == -1 {
		out.Command = Command(dataStr)
		out.Arguments = nil
		return nil
	} else {
		out.Command = Command(dataStr[:spaceIdx])
	}
	dataStr = dataStr[spaceIdx+1:]
	argumentsJson := dataStr
	out.origArguments = argumentsJson
	err = out.parseOrigArguments()
	if err != nil {
		return
	}
	return nil
}

func (cm *ClientMessage) parseOrigArguments() error {
	err := json.Unmarshal([]byte(cm.origArguments), &cm.Arguments)
	if err != nil {
		return err
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
		Command:   SuccessCommand,
		Arguments: arguments,
	}
}

// Convenience method: Parse the arguments of the ClientMessage as a single string.
func (cm *ClientMessage) ArgumentsAsString() (string1 string, err error) {
	var ok bool
	string1, ok = cm.Arguments.(string)
	if !ok {
		err = ExpectedSingleString
		return
	} else {
		return string1, nil
	}
}

// Convenience method: Parse the arguments of the ClientMessage as a single int.
func (cm *ClientMessage) ArgumentsAsInt() (int1 int, err error) {
	var ok bool
	var num float64
	num, ok = cm.Arguments.(float64)
	if !ok {
		err = ExpectedSingleInt
		return
	} else {
		int1 = int(num)
		return int1, nil
	}
}

// Convenience method: Parse the arguments of the ClientMessage as an array of two strings.
func (cm *ClientMessage) ArgumentsAsTwoStrings() (string1, string2 string, err error) {
	var ok bool
	var ary []interface{}
	ary, ok = cm.Arguments.([]interface{})
	if !ok {
		err = ExpectedTwoStrings
		return
	} else {
		if len(ary) != 2 {
			err = ExpectedTwoStrings
			return
		}
		string1, ok = ary[0].(string)
		if !ok {
			err = ExpectedTwoStrings
			return
		}
		string2, ok = ary[1].(string)
		if !ok {
			err = ExpectedTwoStrings
			return
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
		err = ExpectedStringAndInt
		return
	} else {
		if len(ary) != 2 {
			err = ExpectedStringAndInt
			return
		}
		string1, ok = ary[0].(string)
		if !ok {
			err = ExpectedStringAndInt
			return
		}
		var num float64
		num, ok = ary[1].(float64)
		if !ok {
			err = ExpectedStringAndInt
			return
		}
		int = int64(num)
		if float64(int) != num {
			err = ExpectedStringAndIntGotFloat
			return
		}
		return string1, int, nil
	}
}

// Convenience method: Parse the arguments of the ClientMessage as an array of a string and an int.
func (cm *ClientMessage) ArgumentsAsStringAndBool() (str string, flag bool, err error) {
	var ok bool
	var ary []interface{}
	ary, ok = cm.Arguments.([]interface{})
	if !ok {
		err = ExpectedStringAndBool
		return
	} else {
		if len(ary) != 2 {
			err = ExpectedStringAndBool
			return
		}
		str, ok = ary[0].(string)
		if !ok {
			err = ExpectedStringAndBool
			return
		}
		flag, ok = ary[1].(bool)
		if !ok {
			err = ExpectedStringAndBool
			return
		}
		return str, flag, nil
	}
}
