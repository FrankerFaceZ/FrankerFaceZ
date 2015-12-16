package server

import (
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/satori/go.uuid"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"sync"
	"syscall"
	"testing"
)

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

	S2CCommandsCacheInfo[TestCommandChan] = PushCommandCacheInfo{CacheTypeLastOnly, MsgTargetTypeChat}
	S2CCommandsCacheInfo[TestCommandMulti] = PushCommandCacheInfo{CacheTypeLastOnly, MsgTargetTypeMultichat}
	S2CCommandsCacheInfo[TestCommandGlobal] = PushCommandCacheInfo{CacheTypeLastOnly, MsgTargetTypeGlobal}

	var server *httptest.Server
	var urls TURLs

	var backendExpected = NewTBackendRequestChecker(t,
		TExpectedBackendRequest{200, bPathAnnounceStartup, &url.Values{"startup": []string{"1"}}, "", nil},
		TExpectedBackendRequest{200, bPathAddTopic, &url.Values{"channels": []string{TestChannelName1}, "added": []string{"t"}}, "ok", nil},
		TExpectedBackendRequest{200, bPathAddTopic, &url.Values{"channels": []string{TestChannelName2}, "added": []string{"t"}}, "ok", nil},
		TExpectedBackendRequest{200, bPathAddTopic, &url.Values{"channels": []string{TestChannelName3}, "added": []string{"t"}}, "ok", nil},
	)
	server, _, urls = TSetup(SetupWantSocketServer|SetupWantBackendServer|SetupWantURLs, backendExpected)

	defer server.CloseClientConnections()
	defer unsubscribeAllClients()
	defer backendExpected.Close()

	var conn *websocket.Conn
	var resp *http.Response
	var err error

	var headers http.Header = make(http.Header)
	headers.Set("Origin", TwitchDotTv)

	// client 1: sub ch1, ch2
	// client 2: sub ch1, ch3
	// client 3: sub none
	// client 4: delayed sub ch1
	// msg 1: ch1
	// msg 2: ch2, ch3
	// msg 3: chEmpty
	// msg 4: global uncached

	// Client 1
	conn, resp, err = websocket.DefaultDialer.Dial(urls.Websocket, headers)
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
	conn, resp, err = websocket.DefaultDialer.Dial(urls.Websocket, headers)
	if err != nil {
		t.Error(err)
		return
	}

	doneWg.Add(1)
	readyWg.Wait() // enforce ordering
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
	conn, resp, err = websocket.DefaultDialer.Dial(urls.Websocket, headers)
	if err != nil {
		t.Error(err)
		return
	}

	doneWg.Add(1)
	readyWg.Wait() // enforce ordering
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
	if !TCheckResponse(t, resp, strconv.Itoa(2), "pub msg 1") {
		t.FailNow()
	}

	// Publish message 2 - should go to clients 1, 2

	form, err = TSealForSavePubMsg(t, TestCommandMulti, TestChannelName2+","+TestChannelName3, TestData2, false)
	if err != nil {
		t.FailNow()
	}
	resp, err = http.PostForm(urls.SavePubMsg, form)
	if !TCheckResponse(t, resp, strconv.Itoa(2), "pub msg 2") {
		t.FailNow()
	}

	// Publish message 3 - should go to no clients

	form, err = TSealForSavePubMsg(t, TestCommandChan, TestChannelNameUnused, TestData3, false)
	if err != nil {
		t.FailNow()
	}
	resp, err = http.PostForm(urls.SavePubMsg, form)
	if !TCheckResponse(t, resp, strconv.Itoa(0), "pub msg 3") {
		t.FailNow()
	}

	// Publish message 4 - should go to clients 1, 2, 3

	form, err = TSealForUncachedPubMsg(t, TestCommandGlobal, "", TestData4, MsgTargetTypeGlobal, false)
	if err != nil {
		t.FailNow()
	}
	resp, err = http.PostForm(urls.UncachedPubMsg, form)
	if !TCheckResponse(t, resp, strconv.Itoa(3), "pub msg 4") {
		t.FailNow()
	}

	// Start client 4
	conn, resp, err = websocket.DefaultDialer.Dial(urls.Websocket, headers)
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

func TestRestrictedCommands(t *testing.T) {
	var doneWg sync.WaitGroup
	var readyWg sync.WaitGroup

	const TestCommandNeedsAuth = "needsauth"
	const TestRequestData = "123456"
	const TestRequestDataJSON = "\"" + TestRequestData + "\""
	const TestReplyData = "success"
	const TestUsername = "sirstendec"

	var server *httptest.Server
	var urls TURLs

	var backendExpected = NewTBackendRequestChecker(t,
		TExpectedBackendRequest{200, bPathAnnounceStartup, &url.Values{"startup": []string{"1"}}, "", nil},
		TExpectedBackendRequest{401, fmt.Sprintf("%s%s", bPathOtherCommand, TestCommandNeedsAuth), &url.Values{"usernameClaimed": []string{""}, "clientData": []string{TestRequestDataJSON}}, "", nil},
		TExpectedBackendRequest{401, fmt.Sprintf("%s%s", bPathOtherCommand, TestCommandNeedsAuth), &url.Values{"usernameClaimed": []string{TestUsername}, "clientData": []string{TestRequestDataJSON}}, "", nil},
		TExpectedBackendRequest{200, fmt.Sprintf("%s%s", bPathOtherCommand, TestCommandNeedsAuth), &url.Values{"usernameVerified": []string{TestUsername}, "clientData": []string{TestRequestDataJSON}}, fmt.Sprintf("\"%s\"", TestReplyData), nil},
	)
	server, _, urls = TSetup(SetupWantSocketServer|SetupWantBackendServer|SetupWantURLs, backendExpected)

	defer server.CloseClientConnections()
	defer unsubscribeAllClients()
	defer backendExpected.Close()

	var conn *websocket.Conn
	var err error
	var challengeChan = make(chan string)

	var headers http.Header = make(http.Header)
	headers.Set("Origin", TwitchDotTv)

	// Client 1
	conn, _, err = websocket.DefaultDialer.Dial(urls.Websocket, headers)
	if err != nil {
		t.Error(err)
		return
	}

	doneWg.Add(1)
	readyWg.Add(1)
	go func(conn *websocket.Conn) {
		defer doneWg.Done()
		defer conn.Close()
		TSendMessage(t, conn, 1, HelloCommand, []interface{}{"ffz_0.0-test", uuid.NewV4().String()})
		TReceiveExpectedMessage(t, conn, 1, SuccessCommand, IgnoreReceivedArguments)
		TSendMessage(t, conn, 2, ReadyCommand, 0)
		TReceiveExpectedMessage(t, conn, 2, SuccessCommand, nil)

		// Should get immediate refusal because no username set
		TSendMessage(t, conn, 3, TestCommandNeedsAuth, TestRequestData)
		TReceiveExpectedMessage(t, conn, 3, ErrorCommand, AuthorizationNeededError)

		// Set a username
		TSendMessage(t, conn, 4, SetUserCommand, TestUsername)
		TReceiveExpectedMessage(t, conn, 4, SuccessCommand, nil)

		// Should get authorization prompt
		TSendMessage(t, conn, 5, TestCommandNeedsAuth, TestRequestData)
		readyWg.Done()
		msg, success := TReceiveExpectedMessage(t, conn, -1, AuthorizeCommand, IgnoreReceivedArguments)
		if !success {
			t.Error("recieve authorize command failed, cannot continue")
			return
		}
		challenge, err := msg.ArgumentsAsString()
		if err != nil {
			t.Error(err)
			return
		}
		challengeChan <- challenge // mocked: sending challenge to IRC server, IRC server sends challenge to socket server

		TReceiveExpectedMessage(t, conn, 5, SuccessCommand, TestReplyData)
	}(conn)

	readyWg.Wait()

	challenge := <-challengeChan
	PendingAuthLock.Lock()
	found := false
	for _, v := range PendingAuths {
		if conn.LocalAddr().String() == v.Client.RemoteAddr.String() {
			found = true
			if v.Challenge != challenge {
				t.Error("Challenge in array was not what client got")
			}
			break
		}
	}
	PendingAuthLock.Unlock()
	if !found {
		t.Fatal("Did not find authorization challenge in the pending auths array")
	}

	submitAuth(TestUsername, challenge)

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
	server, _, urls = TSetup(SetupWantSocketServer|SetupWantURLs, nil)
	defer unsubscribeAllClients()

	var headers http.Header = make(http.Header)
	headers.Set("Origin", TwitchDotTv)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		conn, _, err := websocket.DefaultDialer.Dial(urls.Websocket, headers)
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
