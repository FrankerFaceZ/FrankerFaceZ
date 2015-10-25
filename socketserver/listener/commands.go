package listener

import (
	"golang.org/x/net/websocket"
	"github.com/satori/go.uuid"
	"log"
	"../lib"
)

var ResponseSuccess = ClientMessage{Command: SuccessCommand}
var ResponseFailure = ClientMessage{Command: "False"}

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

	lib.AddToSliceS(&client.CurrentChannels, channel)

	return ResponseSuccess, nil
}

func HandleUnsub(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	lib.RemoveFromSliceS(&client.CurrentChannels, channel)

	return ResponseSuccess, nil
}

func HandleSubChannel(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	lib.AddToSliceS(&client.WatchingChannels, channel)

	return ResponseSuccess, nil
}

func HandleUnsubChannel(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	lib.RemoveFromSliceS(&client.WatchingChannels, channel)

	return ResponseSuccess, nil
}

func HandleChatHistory(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, count, err := msg.ArgumentsAsStringAndInt()

	_ = channel
	_ = count

	// Ignore, send empty history
	return ClientMessage{Arguments: []string{}}, nil
}

func HandleSurvey(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	log.Println("Ignoring survey response from", client.ClientID)
	return ResponseSuccess, nil
}

func HandleUpdateFollowButtons(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	// TODO
	return ResponseFailure, nil
}

func HandleTrackFollow(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ResponseSuccess, nil
}

func HandleEmoticonUses(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ResponseSuccess, nil
}

type EmoteData struct {

}

func HandleTwitchEmote(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	return ResponseSuccess, nil
}

type LinkResponse struct {
	// If true, the link will be colored red.
	Unsafe      bool `json:unsafe`
	// If present, the provided HTML will be shown as the link tooltip.
	TooltipHTML string `json:tooltip,omitempty`

	// Each of the LinkTypes have a special rendering on the client.
	Type        LinkType `json:type,omitempty`

	// A URL to an image to embed.
	// Recognized by several LinkTypes, as well as the empty LinkType
	Full        string `json:full,omitempty`

	// For LinkTypeYoutube, LinkTypeStrawpoll, LinkTypeTwitchVod
	Title string `json:title,omitempty`
	// For LinkTypeYoutube
	Channel string `json:channel,omitempty`
	// For LinkTypeYoutube
	// Seconds
	Duration int `json:duration,omitempty`
	// For LinkTypeYoutube, LinkTypeTwitch, LinkTypeTwitchVod
	Views int `json:views,omitempty`
	// For LinkTypeYoutube
	Likes int `json:likes,omitempty`
	// For LinkTypeStrawpoll
	Items map[string]int `json:items,omitempty`
	// For LinkTypeStrawpoll
	Total int `json:total,omitempty`
	// For LinkTypeStrawpoll
	// TODO - what time format is this
	Fetched string `json:fetched,omitempty`
	// For LinkTypeTwitch, LinkTypeTwitchVod
	DisplayName string `json:display_name,omitempty`
	// For LinkTypeTwitch
	// TODO - what time format is this
	Since string `json:since,omitempty`
	// For LinkTypeTwitch
	Followers int `json:followers,omitempty`
	// For LinkTypeTwitchVod
	BroadcastType string `json:broadcast_type,omitempty`
	// For LinkTypeTwitchVod
	Game string `json:game,omitempty`
	// For LinkTypeTwitchVod
	// Seconds
	Length int `json:length,omitempty`
	// For LinkTypeTwitter
	User string `json:user,omitempty`
	// For LinkTypeTwitter
	Tweet string `json:tweet,omitempty`
	// For LinkTypeReputation
	Trust int `json:trust,omitempty`
	// For LinkTypeReputation
	Safety int `json:safety,omitempty`
}

type LinkType string

const (
	LinkTypeYoutube = "youtube"
	LinkTypeStrawpoll = "strawpoll"
	LinkTypeTwitch = "twitch"
	LinkTypeTwitchVod = "twitch_vod"
	LinkTypeTwitter = "twitter"
	LinkTypeReputation = "reputation"
	LinkTypeShortened = "shortened" // proposed
)
const (
	BroadcastTypeHighlight = "highlight"
	BroadcastTypeFull = "broadcast"
)

func HandleGetLink(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	// TODO
	return ResponseFailure, nil
}

func HandleGetDisplayName(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {

	// TODO
	return ResponseFailure, nil
}
