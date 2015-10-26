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
	"sync"
	"syscall"
	"testing"
)

func TCountOpenFDs() uint64 {
	ary, _ := ioutil.ReadDir(fmt.Sprintf("/proc/%d/fd", os.Getpid()))
	return uint64(len(ary))
}

const IgnoreReceivedArguments = 1+2i
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
		if msg.Arguments != arguments {
			tb.Error("Arguments are wrong. Expected", arguments, ", got", msg.Arguments, ":", msg)
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

type TURLs struct {
	Websocket string
	Origin string
	PubMsg string
}

func TGetUrls(testserver *httptest.Server) TURLs {
	addr := testserver.Listener.Addr().String()
	return TURLs{
		Websocket: fmt.Sprintf("ws://%s/", addr),
		Origin: fmt.Sprintf("http://%s", addr),
		PubMsg: fmt.Sprintf("http://%s/pub_msg", addr),
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

	const TestChannelName = "room.testchannel"
	const TestCommand = "testdata"
	const TestData = "123456789"

	var server *httptest.Server
	var urls TURLs
	TSetup(&server, &urls)
	defer unsubscribeAllClients()

	conn, err := websocket.Dial(urls.Websocket, "", urls.Origin)
	if err != nil {
		t.Error(err)
		return
	}
	doneWg.Add(1)
	readyWg.Add(1)

	go func(conn *websocket.Conn) {
		TSendMessage(t, conn, 1, HelloCommand, []interface{}{"ffz_0.0-test", uuid.NewV4().String()})
		TReceiveExpectedMessage(t, conn, 1, SuccessCommand, IgnoreReceivedArguments)
		TSendMessage(t, conn, 2, "sub", TestChannelName)
		TReceiveExpectedMessage(t, conn, 2, SuccessCommand, nil)

		readyWg.Done()

		TReceiveExpectedMessage(t, conn, -1, TestCommand, TestData)

		conn.Close()
		doneWg.Done()
	}(conn)

	readyWg.Wait()

	form := url.Values{}
	form.Set("cmd", TestCommand)
	argsBytes, _ := json.Marshal(TestData)
	form.Set("args", string(argsBytes))
	form.Set("channel", TestChannelName)
	form.Set("scope", MsgTargetTypeChat.Name())

	sealedForm, err := SealRequest(form)
	if err != nil {
		t.Error(err)
		server.CloseClientConnections()
		panic("halting test")
	}

	resp, err := http.PostForm(urls.PubMsg, sealedForm)
	if err != nil {
		t.Error(err)
		server.CloseClientConnections()
		panic("halting test")
	}

	respBytes, err := ioutil.ReadAll(resp.Body)
	resp.Body.Close()
	respStr := string(respBytes)

	if resp.StatusCode != 200 {
		t.Error("Publish failed: ", resp.StatusCode, respStr)
		server.CloseClientConnections()
		panic("halting test")
	}

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
