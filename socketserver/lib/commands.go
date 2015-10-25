package lib
import (
	"golang.org/x/net/websocket"
	"github.com/satori/go.uuid"
	"log"
)

func HandleHello(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	version, clientId, err := msg.ArgumentsAsTwoStrings()

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

	return ClientMessage{}, nil
}

func HandleSub(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ClientMessage{}, nil
}

func HandleUnsub(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ClientMessage{}, nil
}

func HandleSubChannel(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ClientMessage{}, nil
}

func HandleUnsubChannel(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ClientMessage{}, nil
}

func HandleChatHistory(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	// Ignore, send empty history
	return ClientMessage{Arguments: []string{}}, nil
}

func HandleSurvey(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	log.Println("Ignoring survey response from", client.ClientID)
	return ClientMessage{}, nil
}

func HandleUpdateFollowButtons(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ClientMessage{}, nil
}

func HandleTrackFollow(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ClientMessage{}, nil
}

func HandleEmoticonUses(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ClientMessage{}, nil
}

func HandleTwitchEmote(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ClientMessage{}, nil
}

func HandleGetLink(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ClientMessage{}, nil
}

func HandleGetDisplayName(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ClientMessage{}, nil
}
