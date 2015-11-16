package server

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/satori/go.uuid"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"sync"
	"syscall"
	"testing"
	"time"
)

func TCountOpenFDs() uint64 {
	ary, _ := ioutil.ReadDir(fmt.Sprintf("/proc/%d/fd", os.Getpid()))
	return uint64(len(ary))
}

const IgnoreReceivedArguments = 1 + 2i

func TReceiveExpectedMessage(tb testing.TB, conn *websocket.Conn, messageID int, command Command, arguments interface{}) (ClientMessage, bool) {
	var msg ClientMessage
	var fail bool
	messageType, packet, err := conn.ReadMessage()
	if err != nil {
		tb.Error(err)
		return msg, false
	}
	if messageType != websocket.TextMessage {
		tb.Error("got non-text message", packet)
		return msg, false
	}

	err = UnmarshalClientMessage(packet, messageType, &msg)
	if err != nil {
		tb.Error(err)
		return msg, false
	}
	if msg.MessageID != messageID {
		tb.Error("Message ID was wrong. Expected", messageID, ", got", msg.MessageID, ":", msg)
		fail = true
	}
	if msg.Command != command {
		tb.Error("Command was wrong. Expected", command, ", got", msg.Command, ":", msg)
		fail = true
	}
	if arguments != IgnoreReceivedArguments {
		if arguments == nil {
			if msg.origArguments != "" {
				tb.Error("Arguments are wrong. Expected", arguments, ", got", msg.Arguments, ":", msg)
			}
		} else {
			argBytes, _ := json.Marshal(arguments)
			if msg.origArguments != string(argBytes) {
				tb.Error("Arguments are wrong. Expected", arguments, ", got", msg.Arguments, ":", msg)
			}
		}
	}
	return msg, !fail
}

func TSendMessage(tb testing.TB, conn *websocket.Conn, messageID int, command Command, arguments interface{}) bool {
	SendMessage(conn, ClientMessage{MessageID: messageID, Command: command, Arguments: arguments})
	return true
}

func TSealForSavePubMsg(tb testing.TB, cmd Command, channel string, arguments interface{}, deleteMode bool) (url.Values, error) {
	form := url.Values{}
	form.Set("cmd", string(cmd))
	argsBytes, err := json.Marshal(arguments)
	if err != nil {
		tb.Error(err)
		return nil, err
	}
	form.Set("args", string(argsBytes))
	form.Set("channel", channel)
	if deleteMode {
		form.Set("delete", "1")
	}
	form.Set("time", time.Now().Format(time.UnixDate))

	sealed, err := SealRequest(form)
	if err != nil {
		tb.Error(err)
		return nil, err
	}
	return sealed, nil
}

func TCheckResponse(tb testing.TB, resp *http.Response, expected string) bool {
	var failed bool
	respBytes, err := ioutil.ReadAll(resp.Body)
	resp.Body.Close()
	respStr := string(respBytes)

	if err != nil {
		tb.Error(err)
		failed = true
	}

	if resp.StatusCode != 200 {
		tb.Error("Publish failed: ", resp.StatusCode, respStr)
		failed = true
	}

	if respStr != expected {
		tb.Errorf("Got wrong response from server. Expected: '%s' Got: '%s'", expected, respStr)
		failed = true
	}
	return !failed
}

type TURLs struct {
	Websocket  string
	Origin     string
	PubMsg     string
	SavePubMsg string // update_and_pub
}

func TGetUrls(testserver *httptest.Server) TURLs {
	addr := testserver.Listener.Addr().String()
	return TURLs{
		Websocket:  fmt.Sprintf("ws://%s/", addr),
		Origin:     fmt.Sprintf("http://%s", addr),
		PubMsg:     fmt.Sprintf("http://%s/pub_msg", addr),
		SavePubMsg: fmt.Sprintf("http://%s/update_and_pub", addr),
	}
}

func TSetup(testserver **httptest.Server, urls *TURLs) {
	DumpCache()

	conf := &ConfigFile{
		ServerID:     20,
		UseSSL:       false,
		SocketOrigin: "localhost:2002",
		BannerHTML: `
<!DOCTYPE html>
<title>CatBag</title>
<link rel="stylesheet" href="//cdn.frankerfacez.com/script/catbag.css">
<div id="container">
<div id="zf0"></div><div id="zf1"></div><div id="zf2"></div>
<div id="zf3"></div><div id="zf4"></div><div id="zf5"></div>
<div id="zf6"></div><div id="zf7"></div><div id="zf8"></div>
<div id="zf9"></div><div id="catbag"></div>
<div id="bottom">
	A <a href="http://www.frankerfacez.com/">FrankerFaceZ</a> Service
	&mdash; CatBag by <a href="http://www.twitch.tv/wolsk">Wolsk</a>
</div>
</div>
`,
		OurPublicKey:     []byte{176, 149, 72, 209, 35, 42, 110, 220, 22, 236, 212, 129, 213, 199, 1, 227, 185, 167, 150, 159, 117, 202, 164, 100, 9, 107, 45, 141, 122, 221, 155, 73},
		OurPrivateKey:    []byte{247, 133, 147, 194, 70, 240, 211, 216, 223, 16, 241, 253, 120, 14, 198, 74, 237, 180, 89, 33, 146, 146, 140, 58, 88, 160, 2, 246, 112, 35, 239, 87},
		BackendPublicKey: []byte{19, 163, 37, 157, 50, 139, 193, 85, 229, 47, 166, 21, 153, 231, 31, 133, 41, 158, 8, 53, 73, 0, 113, 91, 13, 181, 131, 248, 176, 18, 1, 107},
	}
	gconfig = conf
	setupBackend(conf)

	if testserver != nil {
		serveMux := http.NewServeMux()
		SetupServerAndHandle(conf, serveMux)

		tserv := httptest.NewUnstartedServer(serveMux)
		*testserver = tserv
		tserv.Start()
		if urls != nil {
			*urls = TGetUrls(tserv)
		}
	}
}

func TestSubscriptionAndPublish(t *testing.T) {
	var doneWg sync.WaitGroup
	var readyWg sync.WaitGroup

	const TestChannelName1 = "room.testchannel"
	const TestChannelName2 = "room.chan2"
	const TestChannelName3 = "room.chan3"
	const TestChannelNameUnused = "room.empty"
	const TestCommandChan = "testdata_single"
	const TestCommandMulti = "testdata_multi"
	const TestCommandGlobal = "testdata_global"
	const TestData1 = "123456789"
	const TestData2 = 42
	const TestData3 = false
	var TestData4 = []interface{}{"str1", "str2", "str3"}

	ServerInitiatedCommands[TestCommandChan] = PushCommandCacheInfo{CacheTypeLastOnly, MsgTargetTypeChat}
	ServerInitiatedCommands[TestCommandMulti] = PushCommandCacheInfo{CacheTypeTimestamps, MsgTargetTypeMultichat}
	ServerInitiatedCommands[TestCommandGlobal] = PushCommandCacheInfo{CacheTypeTimestamps, MsgTargetTypeGlobal}

	var server *httptest.Server
	var urls TURLs
	TSetup(&server, &urls)
	defer server.CloseClientConnections()
	defer unsubscribeAllClients()

	var conn *websocket.Conn
	var resp *http.Response
	var err error

	// client 1: sub ch1, ch2
	// client 2: sub ch1, ch3
	// client 3: sub none
	// client 4: delayed sub ch1
	// msg 1: ch1
	// msg 2: ch2, ch3
	// msg 3: chEmpty
	// msg 4: global

	// Client 1
	conn, resp, err = websocket.DefaultDialer.Dial(urls.Websocket, http.Header{})
	if err != nil {
		t.Error(err)
		return
	}

	doneWg.Add(1)
	readyWg.Add(1)
	go func(conn *websocket.Conn) {
		TSendMessage(t, conn, 1, HelloCommand, []interface{}{"ffz_0.0-test", uuid.NewV4().String()})
		TReceiveExpectedMessage(t, conn, 1, SuccessCommand, IgnoreReceivedArguments)
		TSendMessage(t, conn, 2, "sub", TestChannelName1)
		TReceiveExpectedMessage(t, conn, 2, SuccessCommand, nil)
		TSendMessage(t, conn, 3, "sub", TestChannelName2) // 2
		TReceiveExpectedMessage(t, conn, 3, SuccessCommand, nil)
		TSendMessage(t, conn, 4, "ready", 0)
		TReceiveExpectedMessage(t, conn, 4, SuccessCommand, nil)

		readyWg.Done()

		TReceiveExpectedMessage(t, conn, -1, TestCommandChan, TestData1)
		TReceiveExpectedMessage(t, conn, -1, TestCommandMulti, TestData2)
		TReceiveExpectedMessage(t, conn, -1, TestCommandGlobal, TestData4)

		conn.Close()
		doneWg.Done()
	}(conn)

	// Client 2
	conn, resp, err = websocket.DefaultDialer.Dial(urls.Websocket, http.Header{})
	if err != nil {
		t.Error(err)
		return
	}

	doneWg.Add(1)
	readyWg.Add(1)
	go func(conn *websocket.Conn) {
		TSendMessage(t, conn, 1, HelloCommand, []interface{}{"ffz_0.0-test", uuid.NewV4().String()})
		TReceiveExpectedMessage(t, conn, 1, SuccessCommand, IgnoreReceivedArguments)
		TSendMessage(t, conn, 2, "sub", TestChannelName1)
		TReceiveExpectedMessage(t, conn, 2, SuccessCommand, nil)
		TSendMessage(t, conn, 3, "sub", TestChannelName3) // 3
		TReceiveExpectedMessage(t, conn, 3, SuccessCommand, nil)
		TSendMessage(t, conn, 4, "ready", 0)
		TReceiveExpectedMessage(t, conn, 4, SuccessCommand, nil)

		readyWg.Done()

		TReceiveExpectedMessage(t, conn, -1, TestCommandChan, TestData1)
		TReceiveExpectedMessage(t, conn, -1, TestCommandMulti, TestData2)
		TReceiveExpectedMessage(t, conn, -1, TestCommandGlobal, TestData4)

		conn.Close()
		doneWg.Done()
	}(conn)

	// Client 3
	conn, resp, err = websocket.DefaultDialer.Dial(urls.Websocket, http.Header{})
	if err != nil {
		t.Error(err)
		return
	}

	doneWg.Add(1)
	readyWg.Add(1)
	go func(conn *websocket.Conn) {
		TSendMessage(t, conn, 1, HelloCommand, []interface{}{"ffz_0.0-test", uuid.NewV4().String()})
		TReceiveExpectedMessage(t, conn, 1, SuccessCommand, IgnoreReceivedArguments)
		TSendMessage(t, conn, 2, "ready", 0)
		TReceiveExpectedMessage(t, conn, 2, SuccessCommand, nil)

		readyWg.Done()

		TReceiveExpectedMessage(t, conn, -1, TestCommandGlobal, TestData4)

		conn.Close()
		doneWg.Done()
	}(conn)

	// Wait for clients 1-3
	readyWg.Wait()

	var form url.Values

	// Publish message 1 - should go to clients 1, 2

	form, err = TSealForSavePubMsg(t, TestCommandChan, TestChannelName1, TestData1, false)
	if err != nil {
		t.FailNow()
	}
	resp, err = http.PostForm(urls.SavePubMsg, form)
	if !TCheckResponse(t, resp, strconv.Itoa(2)) {
		t.FailNow()
	}

	// Publish message 2 - should go to clients 1, 2

	form, err = TSealForSavePubMsg(t, TestCommandMulti, TestChannelName2+","+TestChannelName3, TestData2, false)
	if err != nil {
		t.FailNow()
	}
	resp, err = http.PostForm(urls.SavePubMsg, form)
	if !TCheckResponse(t, resp, strconv.Itoa(2)) {
		t.FailNow()
	}

	// Publish message 3 - should go to no clients

	form, err = TSealForSavePubMsg(t, TestCommandChan, TestChannelNameUnused, TestData3, false)
	if err != nil {
		t.FailNow()
	}
	resp, err = http.PostForm(urls.SavePubMsg, form)
	if !TCheckResponse(t, resp, strconv.Itoa(0)) {
		t.FailNow()
	}

	// Publish message 4 - should go to clients 1, 2, 3

	form, err = TSealForSavePubMsg(t, TestCommandGlobal, "", TestData4, false)
	if err != nil {
		t.FailNow()
	}
	resp, err = http.PostForm(urls.SavePubMsg, form)
	if !TCheckResponse(t, resp, strconv.Itoa(3)) {
		t.FailNow()
	}

	// Start client 4
	conn, resp, err = websocket.DefaultDialer.Dial(urls.Websocket, http.Header{})
	if err != nil {
		t.Error(err)
		return
	}

	doneWg.Add(1)
	readyWg.Add(1)
	go func(conn *websocket.Conn) {
		TSendMessage(t, conn, 1, HelloCommand, []interface{}{"ffz_0.0-test", uuid.NewV4().String()})
		TReceiveExpectedMessage(t, conn, 1, SuccessCommand, IgnoreReceivedArguments)
		TSendMessage(t, conn, 2, "sub", TestChannelName1)
		TReceiveExpectedMessage(t, conn, 2, SuccessCommand, nil)
		TSendMessage(t, conn, 3, "ready", 0)
		TReceiveExpectedMessage(t, conn, 3, SuccessCommand, nil)

		// backlog message
		TReceiveExpectedMessage(t, conn, -1, TestCommandChan, TestData1)

		readyWg.Done()

		conn.Close()
		doneWg.Done()
	}(conn)

	readyWg.Wait()

	doneWg.Wait()
	server.Close()
}

func BenchmarkUserSubscriptionSinglePublish(b *testing.B) {
	var doneWg sync.WaitGroup
	var readyWg sync.WaitGroup

	const TestChannelName = "room.testchannel"
	const TestCommand = "testdata"
	const TestData = "123456789"

	message := ClientMessage{MessageID: -1, Command: "testdata", Arguments: TestData}

	fmt.Println()
	fmt.Println(b.N)

	var limit syscall.Rlimit
	syscall.Getrlimit(syscall.RLIMIT_NOFILE, &limit)

	limit.Cur = TCountOpenFDs() + uint64(b.N)*2 + 100

	if limit.Cur > limit.Max {
		b.Skip("Open file limit too low")
		return
	}

	syscall.Setrlimit(syscall.RLIMIT_NOFILE, &limit)

	var server *httptest.Server
	var urls TURLs
	TSetup(&server, &urls)
	defer unsubscribeAllClients()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		conn, _, err := websocket.DefaultDialer.Dial(urls.Websocket, http.Header{})
		if err != nil {
			b.Error(err)
			break
		}
		doneWg.Add(1)
		readyWg.Add(1)
		go func(i int, conn *websocket.Conn) {
			TSendMessage(b, conn, 1, HelloCommand, []interface{}{"ffz_0.0-test", uuid.NewV4().String()})
			TSendMessage(b, conn, 2, "sub", TestChannelName)

			TReceiveExpectedMessage(b, conn, 1, SuccessCommand, IgnoreReceivedArguments)
			TReceiveExpectedMessage(b, conn, 2, SuccessCommand, nil)

			readyWg.Done()

			TReceiveExpectedMessage(b, conn, -1, TestCommand, TestData)

			conn.Close()
			doneWg.Done()
		}(i, conn)
	}

	readyWg.Wait()

	fmt.Println("publishing...")
	if PublishToChannel(TestChannelName, message) != b.N {
		b.Error("not enough sent")
		server.CloseClientConnections()
		panic("halting test instead of waiting")
	}
	doneWg.Wait()
	fmt.Println("...done.")

	b.StopTimer()
	server.Close()
	server.CloseClientConnections()
}
