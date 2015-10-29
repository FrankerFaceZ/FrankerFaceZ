package server // import "bitbucket.org/stendec/frankerfacez/socketserver/internal/server"

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const MAX_PACKET_SIZE = 1024

// A command is how the client refers to a function on the server. It's just a string.
type Command string

// A function that is called to respond to a Command.
type CommandHandler func(*websocket.Conn, *ClientInfo, ClientMessage) (ClientMessage, error)

var CommandHandlers = map[Command]CommandHandler{
	HelloCommand: HandleHello,
	"setuser":    HandleSetUser,
	"ready":      HandleReady,

	"sub":   HandleSub,
	"unsub": HandleUnsub,

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

var SocketUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return r.Header.Get("Origin") == "http://www.twitch.tv"
	},
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

var gconfig *ConfigFile

var BannerHTML []byte

// Set up a websocket listener and register it on /.
// (Uses http.DefaultServeMux .)
func SetupServerAndHandle(config *ConfigFile, serveMux *http.ServeMux) {
	gconfig = config

	SetupBackend(config)

	if serveMux == nil {
		serveMux = http.DefaultServeMux
	}

	bannerBytes, err := ioutil.ReadFile("index.html")
	if err != nil {
		log.Fatal("Could not open index.html", err)
	}
	BannerHTML = bannerBytes

	serveMux.HandleFunc("/", ServeWebsocketOrCatbag)
	serveMux.HandleFunc("/pub_msg", HBackendPublishRequest)
	serveMux.HandleFunc("/dump_backlog", HBackendDumpBacklog)
	serveMux.HandleFunc("/update_and_pub", HBackendUpdateAndPublish)

	go deadChannelReaper()
	go backlogJanitor()
	go sendAggregateData()
}

func ServeWebsocketOrCatbag(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Connection") == "Upgrade" {
		conn, err := SocketUpgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Fprintf(w, "error: %v", err)
			return
		}
		HandleSocketConnection(conn)

		return
	} else {
		w.Write(BannerHTML)
	}
}

var CloseGotBinaryMessage = websocket.CloseError{Code: websocket.CloseUnsupportedData, Text: "got binary packet"}
var CloseGotMessageId0 = websocket.CloseError{Code: websocket.ClosePolicyViolation, Text: "got messageid 0"}
var CloseTimedOut = websocket.CloseError{Code: websocket.CloseNoStatusReceived, Text: "no ping replies for 5 minutes"}
var CloseFirstMessageNotHello = websocket.CloseError{
	Text: "Error - the first message sent must be a 'hello'",
	Code: websocket.ClosePolicyViolation,
}

// Handle a new websocket connection from a FFZ client.
// This runs in a goroutine started by net/http.
func HandleSocketConnection(conn *websocket.Conn) {
	// websocket.Conn is a ReadWriteCloser

	log.Println("Got socket connection from", conn.RemoteAddr())

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

	var client ClientInfo
	client.MessageChannel = _serverMessageChan

	// Launch receiver goroutine
	go func(errorChan chan<- error, clientChan chan<- ClientMessage) {
		var msg ClientMessage
		var messageType int
		var packet []byte
		var err error
		for ; err == nil; messageType, packet, err = conn.ReadMessage() {
			if messageType == websocket.BinaryMessage {
				err = &CloseGotBinaryMessage
				break
			}
			if messageType == websocket.CloseMessage {
				err = io.EOF
				break
			}

			UnmarshalClientMessage(packet, messageType, &msg)
			if msg.MessageID == 0 {
				continue
			}
			clientChan <- msg
		}

		_, isClose := err.(*websocket.CloseError)
		if err != io.EOF && !isClose {
			log.Println("Error while reading from client:", err)
		}
		errorChan <- err
		close(errorChan)
		close(clientChan)
		// exit
	}(_errorChan, _clientChan)

	conn.SetPongHandler(func(pongBody string) error {
		client.pingCount = 0
		return nil
	})

	var errorChan <-chan error = _errorChan
	var clientChan <-chan ClientMessage = _clientChan
	var serverMessageChan <-chan ClientMessage = _serverMessageChan

	// All set up, now enter the work loop

RunLoop:
	for {
		select {
		case err := <-errorChan:
			if err == io.EOF {
				conn.Close() // no need to send a close frame :)
				break RunLoop
			} else if closeMsg, isClose := err.(*websocket.CloseError); isClose {
				CloseConnection(conn, closeMsg)
			} else {
				CloseConnection(conn, &websocket.CloseError{
					Code: websocket.CloseInternalServerErr,
					Text: err.Error(),
				})
			}

			break RunLoop

		case msg := <-clientChan:
			if client.Version == "" && msg.Command != HelloCommand {
				log.Println("error - first message wasn't hello from", conn.RemoteAddr(), "-", msg)
				CloseConnection(conn, &CloseFirstMessageNotHello)
				break RunLoop
			}

			HandleCommand(conn, &client, msg)

		case smsg := <-serverMessageChan:
			SendMessage(conn, smsg)

		case <- time.After(1 * time.Minute):
			client.pingCount++
			if client.pingCount == 5 {
				CloseConnection(conn, &CloseTimedOut)
				break RunLoop
			} else {
				conn.WriteControl(websocket.PingMessage, []byte(strconv.FormatInt(time.Now().Unix(), 10)), getDeadline())
			}
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

	client.MsgChannelKeepalive.Lock()
	client.MessageChannel = nil
	client.MsgChannelKeepalive.Unlock()

	// And finished.
	// Close the channel so the draining goroutine can finish, too.
	close(_serverMessageChan)

	log.Println("End socket connection from", conn.RemoteAddr())
}

func getDeadline() time.Time {
	return time.Now().Add(1 * time.Minute)
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

func CloseConnection(conn *websocket.Conn, closeMsg *websocket.CloseError) {
	if closeMsg != &CloseFirstMessageNotHello {
		log.Println("Terminating connection with", conn.RemoteAddr(), "-", closeMsg.Text)
	}
	conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(closeMsg.Code, closeMsg.Text), getDeadline())
	conn.Close()
}

func SendMessage(conn *websocket.Conn, msg ClientMessage) {
	messageType, packet, err := MarshalClientMessage(msg)
	if err != nil {
		panic(fmt.Sprintf("failed to marshal: %v %v", err, msg))
	}
	conn.SetWriteDeadline(getDeadline())
	conn.WriteMessage(messageType, packet)
}

// Unpack a message sent from the client into a ClientMessage.
func UnmarshalClientMessage(data []byte, payloadType int, v interface{}) (err error) {
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

func MarshalClientMessage(clientMessage interface{}) (payloadType int, data []byte, err error) {
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
			return 0, nil, err
		}

		dataStr = fmt.Sprintf("%d %s %s", msg.MessageID, msg.Command, string(argBytes))
	} else {
		dataStr = fmt.Sprintf("%d %s", msg.MessageID, msg.Command)
	}

	return websocket.TextMessage, []byte(dataStr), nil
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
func (cm *ClientMessage) ArgumentsAsInt() (int1 int64, err error) {
	var ok bool
	var num float64
	num, ok = cm.Arguments.(float64)
	if !ok {
		err = ExpectedSingleInt
		return
	} else {
		int1 = int64(num)
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
		// clientID can be null
		if ary[1] == nil {
			return string1, "", nil
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
