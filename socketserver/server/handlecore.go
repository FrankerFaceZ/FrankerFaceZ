package server // import "github.com/FrankerFaceZ/FrankerFaceZ/socketserver/server"

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unicode/utf8"

	"github.com/gorilla/websocket"
)

// SuccessCommand is a Reply Command to indicate success in reply to a C2S Command.
const SuccessCommand Command = "ok"

// ErrorCommand is a Reply Command to indicate that a C2S Command failed.
const ErrorCommand Command = "error"

// HelloCommand is a C2S Command.
// HelloCommand must be the Command of the first ClientMessage sent during a connection.
// Sending any other command will result in a CloseFirstMessageNotHello.
const HelloCommand Command = "hello"

// ReadyCommand is a C2S Command.
// It indicates that the client is finished sending the initial 'sub' commands and the server should send the backlog.
const ReadyCommand Command = "ready"

const SetUserCommand Command = "setuser"

// AuthorizeCommand is a S2C Command sent as part of Twitch username validation.
const AuthorizeCommand Command = "do_authorize"

// AsyncResponseCommand is a pseudo-Reply Command.
// It indicates that the Reply Command to the client's C2S Command will be delivered
// on a goroutine over the ClientInfo.MessageChannel and should not be delivered immediately.
const AsyncResponseCommand Command = "_async"

const defaultMinMemoryKB = 1024 * 24

// DotTwitchDotTv is the .twitch.tv suffix.
const DotTwitchDotTv = ".twitch.tv"

const dotCbenniDotCom = ".cbenni.com"

var OriginRegexp = regexp.MustCompile("(" + DotTwitchDotTv + "|" + dotCbenniDotCom + ")" + "$")

// ResponseSuccess is a Reply ClientMessage with the MessageID not yet filled out.
var ResponseSuccess = ClientMessage{Command: SuccessCommand}

// Configuration is the active ConfigFile.
var Configuration *ConfigFile

var janitorsOnce sync.Once

var CommandPool *StringPool
var PubSubChannelPool *StringPool
var TwitchChannelPool *StringPool

// SetupServerAndHandle starts all background goroutines and registers HTTP listeners on the given ServeMux.
// Essentially, this function completely preps the server for a http.ListenAndServe call.
// (Uses http.DefaultServeMux if `serveMux` is nil.)
func SetupServerAndHandle(config *ConfigFile, serveMux *http.ServeMux) {
	Configuration = config

	if config.MinMemoryKBytes == 0 {
		config.MinMemoryKBytes = defaultMinMemoryKB
	}

	Backend = setupBackend(config)

	if serveMux == nil {
		serveMux = http.DefaultServeMux
	}

	bannerBytes, err := ioutil.ReadFile("index.html")
	if err != nil {
		log.Fatalln("Could not open index.html:", err)
	}
	BannerHTML = bannerBytes

	serveMux.HandleFunc("/", HTTPHandleRootURL)
	serveMux.Handle("/.well-known/", http.FileServer(http.Dir("/tmp/letsencrypt/")))
	serveMux.HandleFunc("/healthcheck", HTTPSayOK)
	serveMux.HandleFunc("/stats", HTTPShowStatistics)
	serveMux.HandleFunc("/hll/", HTTPShowHLL)
	serveMux.HandleFunc("/hll_force_write", HTTPWriteHLL)

	serveMux.HandleFunc("/drop_backlog", HTTPBackendDropBacklog)
	serveMux.HandleFunc("/uncached_pub", HTTPBackendUncachedPublish)
	serveMux.HandleFunc("/cached_pub", HTTPBackendCachedPublish)
	serveMux.HandleFunc("/get_sub_count", HTTPGetSubscriberCount)
	serveMux.HandleFunc("/all_topics", HTTPListAllTopics)

	for _, route := range config.ProxyRoutes {
		serveMux.Handle(route.Route, ProxyHandler(route))
	}

	announceForm, err := Backend.secureForm.Seal(url.Values{
		"startup": []string{"1"},
	})
	if err != nil {
		log.Fatalln("Unable to seal requests:", err)
	}
	resp, err := Backend.HTTPClient.PostForm(Backend.announceStartupURL, announceForm)
	if err != nil {
		log.Println("could not announce startup to backend:", err)
	} else {
		resp.Body.Close()
		Backend.lastSuccessLock.Lock()
		Backend.lastSuccess[bPathAnnounceStartup] = time.Now().UTC()
		Backend.lastSuccessLock.Unlock()
	}

	janitorsOnce.Do(startJanitors)
}

func init() {
	setupInterning()
}

// startJanitors starts the 'is_init_func' goroutines
func startJanitors() {
	loadUniqueUsers()

	go authorizationJanitor()
	go aggregateDataSender()
	go cachedMessageJanitor()
	go commandCounter()
	go pubsubJanitor()

	go ircConnection()
}

// Shutdown disconnects all clients.
func Shutdown(wg *sync.WaitGroup) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		writeHLL()
	}()
	wg.Add(1)
	go func() {
		defer wg.Done()
		close(StopAcceptingConnectionsCh)
		time.Sleep(2 * time.Second)
	}()
}

// is_init_func +test
func dumpStackOnCtrlZ() {
	ch := make(chan os.Signal)
	signal.Notify(ch, syscall.SIGTSTP)
	for range ch {
		fmt.Println("Got ^Z")

		buf := make([]byte, 10000)
		byteCnt := runtime.Stack(buf, true)
		fmt.Println(string(buf[:byteCnt]))
	}
}

// Join two URL segments
func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	}
	return a + b
}

// ProxyHandler sets up a ReverseProxy for serving content on a route.
func ProxyHandler(route ProxyRoute) *httputil.ReverseProxy {
	target, err := url.Parse(route.Server)
	if err != nil {
		log.Fatalln("Unable to parse proxy URL:", err)
	}

	offset := len(route.Route)
	targetQuery := target.RawQuery

	director := func(req *http.Request) {
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.URL.Path = singleJoiningSlash(target.Path, req.URL.Path[offset:len(req.URL.Path)])
		if targetQuery == "" || req.URL.RawQuery == "" {
			req.URL.RawQuery = targetQuery + req.URL.RawQuery
		} else {
			req.URL.RawQuery = targetQuery + "&" + req.URL.RawQuery
		}
		if _, ok := req.Header["User-Agent"]; !ok {
			// Disable User-Agent
			req.Header.Set("User-Agent", "")
		}
	}

	return &httputil.ReverseProxy{Director: director}
}

// HTTPSayOK replies with 200 and a body of "ok\n".
func HTTPSayOK(w http.ResponseWriter, _ *http.Request) {
	w.(interface {
		WriteString(string) error
	}).WriteString("ok\n")
}

// SocketUpgrader is the websocket.Upgrader currently in use.
var SocketUpgrader = websocket.Upgrader{
	ReadBufferSize:  160,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return r.Header.Get("Origin") == "" || OriginRegexp.MatchString(r.Header.Get("Origin"))
	},
}

// BannerHTML is the content served to web browsers viewing the socket server website.
// Memes go here.
var BannerHTML []byte

// StopAcceptingConnectionsCh is closed while the server is shutting down.
var StopAcceptingConnectionsCh = make(chan struct{})

func shouldRejectConnection() bool {
	memFreeKB := atomic.LoadUint64(&Statistics.SysMemFreeKB)
	if memFreeKB > 0 && memFreeKB < Configuration.MinMemoryKBytes {
		return true
	}

	curClients := atomic.LoadUint64(&Statistics.CurrentClientCount)
	if Configuration.MaxClientCount != 0 && curClients >= Configuration.MaxClientCount {
		return true
	}

	return false
}

// HTTPHandleRootURL is the http.HandleFunc for requests on `/`.
// It either uses the SocketUpgrader or writes out the BannerHTML.
func HTTPHandleRootURL(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		fmt.Println(404)
		return
	}

	if strings.Contains(strings.ToLower(r.Header.Get("Connection")), "upgrade") {
		updateSysMem()

		if shouldRejectConnection() {
			w.WriteHeader(503)
			fmt.Fprint(w, "connection rejected: over capacity")
			return
		}

		conn, err := SocketUpgrader.Upgrade(w, r, nil)
		if err != nil {
			w.WriteHeader(400)
			fmt.Fprintf(w, "error: %v", err)
			return
		}
		RunSocketConnection(conn)

		return
	} else {
		w.Write(BannerHTML)
	}
}

type fatalDecodeError string

func (e fatalDecodeError) Error() string {
	return string(e)
}

func (e fatalDecodeError) IsFatal() bool {
	return true
}

// ErrProtocolGeneric is sent in a ErrorCommand Reply.
var ErrProtocolGeneric error = fatalDecodeError("FFZ Socket protocol error.")

// ErrProtocolNegativeMsgID is sent in a ErrorCommand Reply when a negative MessageID is received.
var ErrProtocolNegativeMsgID error = fatalDecodeError("FFZ Socket protocol error: negative or zero message ID.")

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

// CloseGoingAway is sent when the server is restarting.
var CloseGoingAway = websocket.CloseError{Code: websocket.CloseGoingAway, Text: "server restarting"}

// CloseRebalance is sent when the server has too many clients and needs to shunt some to another server.
var CloseRebalance = websocket.CloseError{Code: websocket.CloseGoingAway, Text: "kicked for rebalancing, please select a new server"}

// CloseGotBinaryMessage is the termination reason when the client sends a binary websocket frame.
var CloseGotBinaryMessage = websocket.CloseError{Code: websocket.CloseUnsupportedData, Text: "got binary packet"}

// CloseTimedOut is the termination reason when the client fails to send or respond to ping frames.
var CloseTimedOut = websocket.CloseError{Code: 3003, Text: "no ping replies for 5 minutes"}

// CloseTooManyBufferedMessages is the termination reason when the sending thread buffers too many messages.
var CloseTooManyBufferedMessages = websocket.CloseError{Code: websocket.CloseMessageTooBig, Text: "too many pending messages"}

// CloseFirstMessageNotHello is the termination reason
var CloseFirstMessageNotHello = websocket.CloseError{
	Text: "Error - the first message sent must be a 'hello'",
	Code: websocket.ClosePolicyViolation,
}

var CloseNonUTF8Data = websocket.CloseError{
	Code: websocket.CloseUnsupportedData,
	Text: "Non UTF8 data recieved. Network corruption likely.",
}

const sendMessageBufferLength = 5
const sendMessageAbortLength = 5

// RunSocketConnection contains the main run loop of a websocket connection.
//
// First, it sets up the channels, the ClientInfo object, and the pong frame handler.
// It starts the reader goroutine pointing at the newly created channels.
// The function then enters the run loop (a `for{select{}}`).
// The run loop is broken when an object is received on errorChan, or if `hello` is not the first C2S Command.
//
// After the run loop stops, the function launches a goroutine to drain
// client.MessageChannel, signals the reader goroutine to stop, unsubscribes
// from all pub/sub channels, waits on MsgChannelKeepalive (remember, the
// messages are being drained), and finally closes client.MessageChannel
// (which ends the drainer goroutine).
func RunSocketConnection(conn *websocket.Conn) {
	// websocket.Conn is a ReadWriteCloser

	atomic.AddUint64(&Statistics.ClientConnectsTotal, 1)
	atomic.AddUint64(&Statistics.CurrentClientCount, 1)

	_clientChan := make(chan ClientMessage)
	_serverMessageChan := make(chan ClientMessage, sendMessageBufferLength)
	_errorChan := make(chan error)
	stoppedChan := make(chan struct{})

	var client ClientInfo
	client.messageChannel = _serverMessageChan
	client.RemoteAddr = conn.RemoteAddr()
	client.MsgChannelIsDone = stoppedChan

	// var report logstasher.ConnectionReport
	// report.ConnectTime = time.Now()
	// report.RemoteAddr = client.RemoteAddr

	conn.SetPongHandler(func(pongBody string) error {
		_clientChan <- ClientMessage{Command: "__ping"}
		return nil
	})

	// All set up, now enter the work loop
	go runSocketReader(conn, &client, _errorChan, _clientChan)
	closeReason := runSocketWriter(conn, &client, _errorChan, _clientChan, _serverMessageChan)

	// Exit
	closeConnection(conn, closeReason)
	// closeConnection(conn, closeReason, &report)

	// We can just drop serverMessageChan and let it be picked up by GC, because all sends are nonblocking.
	_serverMessageChan = nil

	// Closes client.MsgChannelIsDone and also stops the reader thread
	close(stoppedChan)

	// Stop getting messages...
	UnsubscribeAll(&client)

	// Wait for pending jobs to finish...
	client.MsgChannelKeepalive.Wait()

	// And done.

	select {
	case <-StopAcceptingConnectionsCh:
		// Don't perform high contention operations when server is closing
	default:
		atomic.AddUint64(&Statistics.CurrentClientCount, NegativeOne)
		atomic.AddUint64(&Statistics.ClientDisconnectsTotal, 1)

		// report.UsernameWasValidated = client.UsernameValidated
		// report.TwitchUsername = client.TwitchUsername
		// logstasher.Submit(&report)
	}
}

func runSocketReader(conn *websocket.Conn, client *ClientInfo, errorChan chan<- error, clientChan chan<- ClientMessage) {
	var msg ClientMessage
	var messageType int
	var packet []byte
	var err error

	stoppedChan := client.MsgChannelIsDone

	defer close(errorChan)
	defer close(clientChan)

	for ; err == nil; messageType, packet, err = conn.ReadMessage() {
		if messageType == websocket.BinaryMessage {
			err = &CloseGotBinaryMessage
			break
		}
		if messageType == websocket.CloseMessage {
			err = io.EOF
			break
		}

		msg = ClientMessage{}
		msgErr := UnmarshalClientMessage(packet, messageType, &msg)
		if _, ok := msgErr.(interface {
			IsFatal() bool
		}); ok {
			errorChan <- msgErr
			continue
		} else if msgErr != nil {
			client.Send(msg.Reply(ErrorCommand, msgErr.Error()))
			continue
		} else if msg.MessageID == 0 {
			continue
		}
		select {
		case clientChan <- msg:
		case <-stoppedChan:
			return
		}
	}

	select {
	case errorChan <- err:
	case <-stoppedChan:
	}
	// exit goroutine
}

func runSocketWriter(conn *websocket.Conn, client *ClientInfo, errorChan <-chan error, clientChan <-chan ClientMessage, serverMessageChan <-chan ClientMessage) websocket.CloseError {
	pingTicker := time.NewTicker(1 * time.Minute)
	defer pingTicker.Stop()
	lastPacket := time.Now()

	for {
		select {
		case err := <-errorChan:
			if err == io.EOF {
				return websocket.CloseError{
					Code: websocket.CloseGoingAway,
					Text: err.Error(),
				}
			} else if closeMsg, isClose := err.(*websocket.CloseError); isClose {
				return *closeMsg
			} else {
				return websocket.CloseError{
					Code: websocket.CloseInternalServerErr,
					Text: err.Error(),
				}
			}

		case msg := <-clientChan:
			if !client.HelloOK && msg.Command != HelloCommand {
				return CloseFirstMessageNotHello
			}
			lastPacket = time.Now()
			if msg.Command == "__ping" {
				continue // generated by server, not by client
			}

			for _, char := range msg.Command {
				if char == utf8.RuneError {
					return CloseNonUTF8Data
				}
			}

			DispatchC2SCommand(conn, client, msg)

		case msg := <-serverMessageChan:
			if len(serverMessageChan) > sendMessageAbortLength {
				return CloseTooManyBufferedMessages
			}
			if cls, ok := msg.Arguments.(*websocket.CloseError); ok {
				return *cls
			}
			SendMessage(conn, msg)

		case <-pingTicker.C:
			now := time.Now()
			if lastPacket.Add(5 * time.Minute).Before(now) {
				return CloseTimedOut
			} else if lastPacket.Add(1 * time.Minute).Before(now) {
				conn.WriteControl(websocket.PingMessage, []byte(strconv.FormatInt(time.Now().Unix(), 10)), getDeadline())
			}

		case <-StopAcceptingConnectionsCh:
			return CloseGoingAway
		}
	}
}

func getDeadline() time.Time {
	return time.Now().Add(1 * time.Minute)
}

func closeConnection(conn *websocket.Conn, closeMsg websocket.CloseError) {
	closeTxt := closeMsg.Text
	if strings.Contains(closeTxt, "read: connection reset by peer") {
		closeTxt = "read: connection reset by peer"
	} else if strings.Contains(closeTxt, "use of closed network connection") {
		closeTxt = "read: use of closed network connection"
	} else if closeMsg.Code == 1001 {
		closeTxt = "clean shutdown"
	}

	// report.DisconnectCode = closeMsg.Code
	// report.DisconnectReason = closeTxt
	// report.DisconnectTime = time.Now()

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
	atomic.AddUint64(&Statistics.MessagesSent, 1)
}

// UnmarshalClientMessage unpacks websocket TextMessage into a ClientMessage provided in the `v` parameter.
func UnmarshalClientMessage(data []byte, _ int, v interface{}) (err error) {
	var spaceIdx int

	out := v.(*ClientMessage)
	dataStr := string(data)

	if len(dataStr) == 0 {
		out.MessageID = 0
		return nil // test: ignore empty frames
	}
	// Message ID
	spaceIdx = strings.IndexRune(dataStr, ' ')
	if spaceIdx == -1 {
		return ErrProtocolGeneric // fatal error
	}
	messageID, err := strconv.Atoi(dataStr[:spaceIdx])
	if messageID < -1 || messageID == 0 {
		return ErrProtocolNegativeMsgID // fatal error
	}

	out.MessageID = messageID
	dataStr = dataStr[spaceIdx+1:]

	spaceIdx = strings.IndexRune(dataStr, ' ')
	if spaceIdx == -1 {
		out.Command = CommandPool.InternCommand(dataStr)
		out.Arguments = nil
		out.origArguments = ""
		return nil
	} else {
		out.Command = CommandPool.InternCommand(dataStr[:spaceIdx])
	}
	dataStr = dataStr[spaceIdx+1:]
	argumentsJSON := string([]byte(dataStr))
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

// returns payloadType, data, err
func MarshalClientMessage(clientMessage interface{}) (int, []byte, error) {
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

	if msg.Command == "" && msg.MessageID == 0 {
		panic("MarshalClientMessage: attempt to send an empty ClientMessage")
	}

	if msg.Command == "" {
		msg.Command = SuccessCommand
	}
	if msg.MessageID == 0 {
		msg.MessageID = -1
	}

	// optimized from fmt.Sprintf("%d %s %s", msg.MessageID, msg.Command, ...)
	var buf bytes.Buffer
	fmt.Fprint(&buf, msg.MessageID)
	buf.WriteByte(' ')
	buf.WriteString(string(msg.Command))

	if msg.origArguments != "" {
		buf.WriteByte(' ')
		buf.WriteString(msg.origArguments)
	} else if msg.Arguments != nil {
		argBytes, err := json.Marshal(msg.Arguments)
		if err != nil {
			return 0, nil, err
		}
		buf.WriteByte(' ')
		buf.Write(argBytes)
	}

	return websocket.TextMessage, buf.Bytes(), nil
}

// ArgumentsAsString parses the arguments of the ClientMessage as a single string.
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

// ArgumentsAsInt parses the arguments of the ClientMessage as a single int.
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

// ArgumentsAsTwoStrings parses the arguments of the ClientMessage as an array of two strings.
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

// ArgumentsAsStringAndInt parses the arguments of the ClientMessage as an array of a string and an int.
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

// ArgumentsAsStringAndBool parses the arguments of the ClientMessage as an array of a string and an int.
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
