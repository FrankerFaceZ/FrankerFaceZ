package server
import (
	"testing"
	"net/http/httptest"
	"net/http"
	"sync"
	"golang.org/x/net/websocket"
	"github.com/satori/go.uuid"
	"fmt"
	"syscall"
	"os"
	"io/ioutil"
)

func CountOpenFDs() uint64 {
	ary, _ := ioutil.ReadDir(fmt.Sprintf("/proc/%d/fd", os.Getpid()))
	return uint64(len(ary))
}

func BenchmarkThousandUserSubscription(b *testing.B) {
	var doneWg sync.WaitGroup
	var readyWg sync.WaitGroup

	const TestChannelName = "testchannel"
	const TestCommand = "testdata"

	GenerateKeys("/tmp/test_naclkeys.json", "2", "+ZMqOmxhaVrCV5c0OMZ09QoSGcJHuqQtJrwzRD+JOjE=")
	conf := &Config{
		UseSSL: false,
		NaclKeysFile: "/tmp/test_naclkeys.json",
		SocketOrigin: "localhost:2002",
	}
	serveMux := http.NewServeMux()
	SetupServerAndHandle(conf, nil, serveMux)

	server := httptest.NewUnstartedServer(serveMux)
	server.Start()

	wsUrl := fmt.Sprintf("ws://%s/", server.Listener.Addr().String())
	originUrl := fmt.Sprintf("http://%s", server.Listener.Addr().String())

	message := ClientMessage{MessageID: -1, Command: "testdata", Arguments: "123456789"}

	fmt.Println()
	fmt.Println(b.N)

	var limit syscall.Rlimit
	syscall.Getrlimit(syscall.RLIMIT_NOFILE, &limit)

	limit.Cur = CountOpenFDs() + uint64(b.N) * 2 + 100

	if limit.Cur > limit.Max {
		b.Skip("Open file limit too low")
		return
	}

	syscall.Setrlimit(syscall.RLIMIT_NOFILE, &limit)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		conn, err := websocket.Dial(wsUrl, "", originUrl)
		if err != nil {
			b.Error(err)
			break
		}
		doneWg.Add(1)
		readyWg.Add(1)
		go func(i int, conn *websocket.Conn) {
			var err error
			var msg ClientMessage
			err = FFZCodec.Send(conn, ClientMessage{MessageID: 1, Command: HelloCommand, Arguments: []interface{}{"ffz_test", uuid.NewV4().String()}})
			if err != nil {
				b.Error(err)
			}
			err = FFZCodec.Send(conn, ClientMessage{MessageID: 2, Command: "sub", Arguments: TestChannelName})
			if err != nil {
				b.Error(err)
			}
			err = FFZCodec.Receive(conn, &msg)
			if err != nil {
				b.Error(err)
			}
			if msg.MessageID != 1 {
				b.Error("Got out-of-order message ID", msg)
			}
			if msg.Command != SuccessCommand {
				b.Error("Command was not a success", msg)
			}
			err = FFZCodec.Receive(conn, &msg)
			if err != nil {
				b.Error(err)
			}
			if msg.MessageID != 2 {
				b.Error("Got out-of-order message ID", msg)
			}
			if msg.Command != SuccessCommand {
				b.Error("Command was not a success", msg)
			}

			fmt.Println(i, " ready")
			readyWg.Done()

			err = FFZCodec.Receive(conn, &msg)
			if err != nil {
				b.Error(err)
			}
			if msg.MessageID != -1 {
				fmt.Println(msg)
				b.Error("Client did not get expected messageID of -1")
			}
			if msg.Command != TestCommand {
				fmt.Println(msg)
				b.Error("Client did not get expected command")
			}
			str, err := msg.ArgumentsAsString()
			if err != nil {
				b.Error(err)
			}
			if str != "123456789" {
				fmt.Println(msg)
				b.Error("Client did not get expected data")
			}
			conn.Close()
			doneWg.Done()
		}(i, conn)
	}

	readyWg.Wait()

	fmt.Println("publishing...")
	if PublishToChat(TestChannelName, message) != b.N {
		b.Error("not enough sent")
		b.FailNow()
	}
	doneWg.Wait()

	b.StopTimer()
	server.Close()
	unsubscribeAllClients()
	server.CloseClientConnections()
}
