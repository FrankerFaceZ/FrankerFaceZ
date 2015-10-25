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
	"fmt"
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
	MessageID int
    // The command that the client wants from the server.
    // When sent from the server, the literal string 'True' indicates success.
	// Before sending, a blank Command will be converted into SuccessCommand.
	Command   Command
	Arguments interface{}
}

// Sent by the server in ClientMessage.Command to indicate success.
const SuccessCommand Command = "True"

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
	var msg ClientMessage
	var err error = nil
	var abort bool

	log.Print("Got a connection from ", conn.RemoteAddr())

	for ; err == nil || abort; err = FFZCodec.Receive(conn, &msg) {
		log.Print(msg)
	}

	if err != nil {
		FFZCodec.Send(conn, ClientMessage{
			MessageID: -1,
			Command: "error",
			Arguments: err.Error(),
		})
	}
	conn.Close()
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

	if msg.Command == "" {
		msg.Command = SuccessCommand
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
