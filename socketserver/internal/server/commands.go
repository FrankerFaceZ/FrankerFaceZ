package server

import (
	"golang.org/x/net/websocket"
	"github.com/satori/go.uuid"
	"log"
)

var ResponseSuccess = ClientMessage{Command: SuccessCommand}
var ResponseFailure = ClientMessage{Command: "False"}

func HandleCommand(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) {
	handler, ok := CommandHandlers[msg.Command]
	if !ok {
		log.Print("[!] Unknown command", msg.Command, "- sent by client", client.ClientID, "@", conn.RemoteAddr())
		// uncomment after commands are implemented
		// closer()
		return
	}

	log.Println(conn.RemoteAddr(), msg.MessageID, msg.Command, msg.Arguments)

	client.Mutex.Lock()
	response, err := CallHandler(handler, conn, client, msg)
	client.Mutex.Unlock()

	if err == nil {
		response.MessageID = msg.MessageID
		FFZCodec.Send(conn, response)
	} else if response.Command == AsyncResponseCommand {
		// Don't send anything
		// The response will be delivered over client.MessageChannel / serverMessageChan
	} else {
		FFZCodec.Send(conn, ClientMessage{
			MessageID: msg.MessageID,
			Command: "error",
			Arguments: err.Error(),
		})
	}
}

func HandleHello(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	version, clientId, err := msg.ArgumentsAsTwoStrings()
	if err != nil {
		return
	}

	client.Version = version
	client.ClientID = uuid.FromStringOrNil(clientId)
	if client.ClientID == uuid.Nil {
		client.ClientID = uuid.NewV4()
	}

	return ClientMessage{
		Arguments: client.ClientID.String(),
	}, nil
}

func HandleSetUser(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	username, err := msg.ArgumentsAsString()
	if err != nil {
		return
	}

	client.TwitchUsername = username
	client.UsernameValidated = false

	return ResponseSuccess, nil
}

func HandleSub(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	AddToSliceS(&client.CurrentChannels, channel)

	// TODO - get backlog

	return ResponseSuccess, nil
}

func HandleUnsub(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	RemoveFromSliceS(&client.CurrentChannels, channel)

	return ResponseSuccess, nil
}

func HandleSubChannel(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	AddToSliceS(&client.WatchingChannels, channel)

	// TODO - get backlog

	return ResponseSuccess, nil
}

func HandleUnsubChannel(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	RemoveFromSliceS(&client.WatchingChannels, channel)

	return ResponseSuccess, nil
}

func HandleSurvey(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	log.Println("Ignoring survey response from", client.ClientID)
	return ResponseSuccess, nil
}

func HandleTrackFollow(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ResponseSuccess, nil
}

func HandleEmoticonUses(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ResponseSuccess, nil
}

func HandleRemoteCommand(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	go func(conn *websocket.Conn, msg ClientMessage, authInfo AuthInfo) {
		resp, err := RequestRemoteDataCached(string(msg.Command), msg.origArguments, authInfo)

		if err != nil {
			FFZCodec.Send(conn, ClientMessage{MessageID: msg.MessageID, Command: ErrorCommand, Arguments: err.Error()})
		} else {
			FFZCodec.Send(conn, ClientMessage{MessageID: msg.MessageID, Command: SuccessCommand, origArguments: resp})
		}
	}(conn, msg, client.AuthInfo)

	return ClientMessage{Command: AsyncResponseCommand}, nil
}
