package server // import "bitbucket.org/stendec/frankerfacez/socketserver/server"

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf8"
)

// SuccessCommand is a Reply Command to indicate success in reply to a C2S Command.
const SuccessCommand Command = "ok"

// ErrorCommand is a Reply Command to indicate that a C2S Command failed.
const ErrorCommand Command = "error"

// HelloCommand is a C2S Command.
// HelloCommand must be the Command of the first ClientMessage sent during a connection.
// Sending any other command will result in a CloseFirstMessageNotHello.
const HelloCommand Command = "hello"

// AuthorizeCommand is a S2C Command sent as part of Twitch username validation.
const AuthorizeCommand Command = "do_authorize"

// AsyncResponseCommand is a pseudo-Reply Command.
// It indicates that the Reply Command to the client's C2S Command will be delivered
// on a goroutine over the ClientInfo.MessageChannel and should not be delivered immediately.
const AsyncResponseCommand Command = "_async"

const defaultMinMemoryKB = 1024 * 24

// TwitchDotTv is the http origin for twitch.tv.
const TwitchDotTv = "http://www.twitch.tv"

// ResponseSuccess is a Reply ClientMessage with the MessageID not yet filled out.
var ResponseSuccess = ClientMessage{Command: SuccessCommand}

// Configuration is the active ConfigFile.
var Configuration *ConfigFile

// SetupServerAndHandle starts all background goroutines and registers HTTP listeners on the given ServeMux.
// Essentially, this function completely preps the server for a http.ListenAndServe call.
// (Uses http.DefaultServeMux if `serveMux` is nil.)
func SetupServerAndHandle(config *ConfigFile, serveMux *http.ServeMux) {
	Configuration = config

	if config.MinMemoryKBytes == 0 {
		config.MinMemoryKBytes = defaultMinMemoryKB
	}

	setupBackend(config)

	if serveMux == nil {
		serveMux = http.DefaultServeMux
	}

	bannerBytes, err := ioutil.ReadFile("index.html")
	if err != nil {
		log.Fatalln("Could not open index.html:", err)
	}
	BannerHTML = bannerBytes

	serveMux.HandleFunc("/", HTTPHandleRootURL)
	serveMux.Handle("/.well-known/", http.FileServer(http.FileSystem(http.Dir("/tmp/letsencrypt/"))))
	serveMux.HandleFunc("/stats", HTTPShowStatistics)

	serveMux.HandleFunc("/drop_backlog", HTTPBackendDropBacklog)
	serveMux.HandleFunc("/uncached_pub", HTTPBackendUncachedPublish)
	serveMux.HandleFunc("/cached_pub", HTTPBackendCachedPublish)

	announceForm, err := SealRequest(url.Values{
		"startup": []string{"1"},
	})
	if err != nil {
		log.Fatalln("Unable to seal requests:", err)
	}
	resp, err := backendHTTPClient.PostForm(announceStartupURL, announceForm)
	if err != nil {
		log.Println("could not announce startup to backend:", err)
	} else {
		resp.Body.Close()
	}

	go authorizationJanitor()
	go bunchCacheJanitor()
	go pubsubJanitor()
	go aggregateDataSender()

	go ircConnection()
}

// SocketUpgrader is the websocket.Upgrader currently in use.
var SocketUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return r.Header.Get("Origin") == TwitchDotTv
	},
}

// BannerHTML is the content served to web browsers viewing the socket server website.
// Memes go here.
var BannerHTML []byte

// HTTPHandleRootURL is the http.HandleFunc for requests on `/`.
// It either uses the SocketUpgrader or writes out the BannerHTML.
func HTTPHandleRootURL(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		fmt.Println(404)
		return
	}
	if r.Header.Get("Connection") == "Upgrade" {
		updateSysMem()

		if Statistics.SysMemTotalKB-Statistics.SysMemFreeKB < Configuration.MinMemoryKBytes {
			w.WriteHeader(503)
			return
		}

		conn, err := SocketUpgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Fprintf(w, "error: %v", err)
			return
		}
		RunSocketConnection(conn)

		return
	} else {
		w.Write(BannerHTML)
	}
}

// ErrProtocolGeneric is sent in a ErrorCommand Reply.
var ErrProtocolGeneric error = errors.New("FFZ Socket protocol error.")

// ErrProtocolNegativeMsgID is sent in a ErrorCommand Reply when a negative MessageID is received.
var ErrProtocolNegativeMsgID error = errors.New("FFZ Socket protocol error: negative or zero message ID.")

// ErrExpectedSingleString is sent in a ErrorCommand Reply when the Arguments are of the wrong type.
var ErrExpectedSingleString = errors.New("Error: Expected single string as arguments.")

// ErrExpectedSingleInt is sent in a ErrorCommand Reply when the Arguments are of the wrong type.
var ErrExpectedSingleInt = errors.New("Error: Expected single integer as arguments.")

// ErrExpectedTwoStrings is sent in a ErrorCommand Reply when the Arguments are of the wrong type.
var ErrExpectedTwoStrings = errors.New("Error: Expected array of string, string as arguments.")

// ErrExpectedStringAndBool is sent in a ErrorCommand Reply when the Arguments are of the wrong type.
var ErrExpectedStringAndBool = errors.New("Error: Expected array of string, bool as arguments.")

// ErrExpectedStringAndInt is sent in a ErrorCommand Reply when the Arguments are of the wrong type.
var ErrExpectedStringAndInt = errors.New("Error: Expected array of string, int as arguments.")

// ErrExpectedStringAndIntGotFloat is sent in a ErrorCommand Reply when the Arguments are of the wrong type.
var ErrExpectedStringAndIntGotFloat = errors.New("Error: Second argument was a float, expected an integer.")

// CloseGotBinaryMessage is the termination reason when the client sends a binary websocket frame.
var CloseGotBinaryMessage = websocket.CloseError{Code: websocket.CloseUnsupportedData, Text: "got binary packet"}

// CloseTimedOut is the termination reason when the client fails to send or respond to ping frames.
var CloseTimedOut = websocket.CloseError{Code: websocket.CloseNoStatusReceived, Text: "no ping replies for 5 minutes"}

// CloseTooManyBufferedMessages is the termination reason when the sending thread buffers too many messages.
var CloseTooManyBufferedMessages = websocket.CloseError{Code: websocket.CloseMessageTooBig, Text: "too many pending messages"}

// CloseFirstMessageNotHello is the termination reason
var CloseFirstMessageNotHello = websocket.CloseError{
	Text: "Error - the first message sent must be a 'hello'",
	Code: websocket.ClosePolicyViolation,
}

var CloseNonUTF8Data = websocket.CloseError{
	Code: 4001,
	Text: "Non UTF8 data recieved. Network corruption likely.",
}

const sendMessageBufferLength = 125
const sendMessageAbortLength = 50

// RunSocketConnection contains the main run loop of a websocket connection.

// First, it sets up the channels, the ClientInfo object, and the pong frame handler.
// It starts the reader goroutine pointing at the newly created channels.
// The function then enters the run loop (a `for{select{}}`).
// The run loop is broken when an object is received on errorChan, or if `hello` is not the first C2S Command.

// After the run loop stops, the function launches a goroutine to drain
// client.MessageChannel, signals the reader goroutine to stop, unsubscribes
// from all pub/sub channels, waits on MsgChannelKeepalive (remember, the
// messages are being drained), and finally closes client.MessageChannel
// (which ends the drainer goroutine).
func RunSocketConnection(conn *websocket.Conn) {
	// websocket.Conn is a ReadWriteCloser

	atomic.AddUint64(&Statistics.ClientConnectsTotal, 1)
	atomic.AddUint64(&Statistics.CurrentClientCount, 1)

	var _closer sync.Once
	closer := func() {
		_closer.Do(func() {
			conn.Close()
		})
	}

	// Close the connection when we're done.
	defer closer()

	_clientChan := make(chan ClientMessage)
	_serverMessageChan := make(chan ClientMessage, sendMessageBufferLength)
	_errorChan := make(chan error)
	stoppedChan := make(chan struct{})

	var client ClientInfo
	client.MessageChannel = _serverMessageChan
	client.RemoteAddr = conn.RemoteAddr()
	client.MsgChannelIsDone = stoppedChan

	// Launch receiver goroutine
	go func(errorChan chan<- error, clientChan chan<- ClientMessage, stoppedChan <-chan struct{}) {
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
			select {
			case clientChan <- msg:
			case <-stoppedChan:
				close(errorChan)
				close(clientChan)
				return
			}
		}

		select {
		case errorChan <- err:
		case <-stoppedChan:
		}
		close(errorChan)
		close(clientChan)
		// exit goroutine
	}(_errorChan, _clientChan, stoppedChan)

	conn.SetPongHandler(func(pongBody string) error {
		client.Mutex.Lock()
		client.pingCount = 0
		client.Mutex.Unlock()
		return nil
	})

	var errorChan <-chan error = _errorChan
	var clientChan <-chan ClientMessage = _clientChan
	var serverMessageChan <-chan ClientMessage = _serverMessageChan

	// All set up, now enter the work loop

	var closeReason websocket.CloseError

RunLoop:
	for {
		select {
		case err := <-errorChan:
			if err == io.EOF {
				closeReason = websocket.CloseError{
					Code: websocket.CloseGoingAway,
					Text: err.Error(),
				}
			} else if closeMsg, isClose := err.(*websocket.CloseError); isClose {
				closeReason = *closeMsg
			} else {
				closeReason = websocket.CloseError{
					Code: websocket.CloseInternalServerErr,
					Text: err.Error(),
				}
			}
			break RunLoop

		case msg := <-clientChan:
			if client.VersionString == "" && msg.Command != HelloCommand {
				closeReason = CloseFirstMessageNotHello
				break RunLoop
			}

			for _, char := range msg.Command {
				if char == utf8.RuneError {
					closeReason = CloseNonUTF8Data
					break RunLoop
				}
			}

			DispatchC2SCommand(conn, &client, msg)

		case msg := <-serverMessageChan:
			if len(serverMessageChan) > sendMessageAbortLength {
				closeReason = CloseTooManyBufferedMessages
				break RunLoop
			}
			SendMessage(conn, msg)

		case <-time.After(1 * time.Minute):
			client.Mutex.Lock()
			client.pingCount++
			tooManyPings := client.pingCount == 5
			client.Mutex.Unlock()
			if tooManyPings {
				closeReason = CloseTimedOut
				break RunLoop
			} else {
				conn.WriteControl(websocket.PingMessage, []byte(strconv.FormatInt(time.Now().Unix(), 10)), getDeadline())
			}
		}
	}

	// Exit
	CloseConnection(conn, closeReason)

	// Launch message draining goroutine - we aren't out of the pub/sub records
	go func() {
		for _ = range _serverMessageChan {
		}
	}()

	close(stoppedChan)

	// Stop getting messages...
	UnsubscribeAll(&client)

	// Wait for pending jobs to finish...
	client.MsgChannelKeepalive.Wait()
	client.MessageChannel = nil

	// And done.
	// Close the channel so the draining goroutine can finish, too.
	close(_serverMessageChan)

	atomic.AddUint64(&Statistics.ClientDisconnectsTotal, 1)
	atomic.AddUint64(&Statistics.CurrentClientCount, ^uint64(0))
}

func getDeadline() time.Time {
	return time.Now().Add(1 * time.Minute)
}

func CloseConnection(conn *websocket.Conn, closeMsg websocket.CloseError) {
	closeTxt := closeMsg.Text
	if strings.Contains(closeTxt, "read: connection reset by peer") {
		closeTxt = "read: connection reset by peer"
	} else if strings.Contains(closeTxt, "use of closed network connection") {
		closeTxt = "read: use of closed network connection"
	} else if closeMsg.Code == 1001 {
		closeTxt = "clean shutdown"
	}
	// todo kibana cannot analyze these
	Statistics.DisconnectCodes[strconv.Itoa(closeMsg.Code)]++
	Statistics.DisconnectReasons[closeTxt]++

	conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(closeMsg.Code, closeMsg.Text), getDeadline())
	conn.Close()
}

// SendMessage sends a ClientMessage over the websocket connection with a timeout.
// If marshalling the ClientMessage fails, this function will panic.
func SendMessage(conn *websocket.Conn, msg ClientMessage) {
	messageType, packet, err := MarshalClientMessage(msg)
	if err != nil {
		panic(fmt.Sprintf("failed to marshal: %v %v", err, msg))
	}
	conn.SetWriteDeadline(getDeadline())
	conn.WriteMessage(messageType, packet)
	Statistics.MessagesSent++
}

// UnmarshalClientMessage unpacks websocket TextMessage into a ClientMessage provided in the `v` parameter.
func UnmarshalClientMessage(data []byte, payloadType int, v interface{}) (err error) {
	var spaceIdx int

	out := v.(*ClientMessage)
	dataStr := string(data)

	// Message ID
	spaceIdx = strings.IndexRune(dataStr, ' ')
	if spaceIdx == -1 {
		return ErrProtocolGeneric
	}
	messageID, err := strconv.Atoi(dataStr[:spaceIdx])
	if messageID < -1 || messageID == 0 {
		return ErrProtocolNegativeMsgID
	}

	out.MessageID = messageID
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
	argumentsJSON := dataStr
	out.origArguments = argumentsJSON
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

// Convenience method: Parse the arguments of the ClientMessage as a single string.
func (cm *ClientMessage) ArgumentsAsString() (string1 string, err error) {
	var ok bool
	string1, ok = cm.Arguments.(string)
	if !ok {
		err = ErrExpectedSingleString
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
		err = ErrExpectedSingleInt
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
		err = ErrExpectedTwoStrings
		return
	} else {
		if len(ary) != 2 {
			err = ErrExpectedTwoStrings
			return
		}
		string1, ok = ary[0].(string)
		if !ok {
			err = ErrExpectedTwoStrings
			return
		}
		// clientID can be null
		if ary[1] == nil {
			return string1, "", nil
		}
		string2, ok = ary[1].(string)
		if !ok {
			err = ErrExpectedTwoStrings
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
		err = ErrExpectedStringAndInt
		return
	} else {
		if len(ary) != 2 {
			err = ErrExpectedStringAndInt
			return
		}
		string1, ok = ary[0].(string)
		if !ok {
			err = ErrExpectedStringAndInt
			return
		}
		var num float64
		num, ok = ary[1].(float64)
		if !ok {
			err = ErrExpectedStringAndInt
			return
		}
		int = int64(num)
		if float64(int) != num {
			err = ErrExpectedStringAndIntGotFloat
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
		err = ErrExpectedStringAndBool
		return
	} else {
		if len(ary) != 2 {
			err = ErrExpectedStringAndBool
			return
		}
		str, ok = ary[0].(string)
		if !ok {
			err = ErrExpectedStringAndBool
			return
		}
		flag, ok = ary[1].(bool)
		if !ok {
			err = ErrExpectedStringAndBool
			return
		}
		return str, flag, nil
	}
}
