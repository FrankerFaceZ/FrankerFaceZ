package server

import (
	"encoding/json"
	"fmt"
	"github.com/satori/go.uuid"
	"golang.org/x/net/websocket"
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

func TReceiveExpectedMessage(tb testing.TB, conn *websocket.Conn, messageId int, command Command, arguments interface{}) (ClientMessage, bool) {
	var msg ClientMessage
	var fail bool
	err := FFZCodec.Receive(conn, &msg)
	if err != nil {
		tb.Error(err)
		return msg, false
	}
	if msg.MessageID != messageId {
		tb.Error("Message ID was wrong. Expected", messageId, ", got", msg.MessageID, ":", msg)
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

func TSendMessage(tb testing.TB, conn *websocket.Conn, messageId int, command Command, arguments interface{}) bool {
	err := FFZCodec.Send(conn, ClientMessage{MessageID: messageId, Command: command, Arguments: arguments})
	if err != nil {
		tb.Error(err)
	}
	return err == nil
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

const TNaclKeysLocation = "/tmp/test_naclkeys.json"

func TSetup(testserver **httptest.Server, urls *TURLs) {
	if backendSharedKey[0] == 0 {
		GenerateKeys(TNaclKeysLocation, "2", "+ZMqOmxhaVrCV5c0OMZ09QoSGcJHuqQtJrwzRD+JOjE=")
	}
	DumpCache()

	if testserver != nil {
		conf := &Config{
			UseSSL:       false,
			NaclKeysFile: TNaclKeysLocation,
			SocketOrigin: "localhost:2002",
		}
		serveMux := http.NewServeMux()
		SetupServerAndHandle(conf, nil, serveMux)

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
	conn, err = websocket.Dial(urls.Websocket, "", urls.Origin)
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
	conn, err = websocket.Dial(urls.Websocket, "", urls.Origin)
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
	conn, err = websocket.Dial(urls.Websocket, "", urls.Origin)
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
	var resp *http.Response

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
	conn, err = websocket.Dial(urls.Websocket, "", urls.Origin)
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
		conn, err := websocket.Dial(urls.Websocket, "", urls.Origin)
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
	if PublishToChat(TestChannelName, message) != b.N {
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
