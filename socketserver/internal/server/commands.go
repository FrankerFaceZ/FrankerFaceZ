package server

import (
	"github.com/satori/go.uuid"
	"golang.org/x/net/websocket"
	"log"
	"strconv"
	"sync"
	"time"
)

var ResponseSuccess = ClientMessage{Command: SuccessCommand}
var ResponseFailure = ClientMessage{Command: "False"}

const ChannelInfoDelay = 2 * time.Second

func HandleCommand(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) {
	handler, ok := CommandHandlers[msg.Command]
	if !ok {
		log.Print("[!] Unknown command", msg.Command, "- sent by client", client.ClientID, "@", conn.RemoteAddr())
		// uncomment after commands are implemented
		// closer()
		return
	}

	//	log.Println(conn.RemoteAddr(), msg.MessageID, msg.Command, msg.Arguments)

	response, err := CallHandler(handler, conn, client, msg)

	if err == nil {
		response.MessageID = msg.MessageID
		FFZCodec.Send(conn, response)
	} else if response.Command == AsyncResponseCommand {
		// Don't send anything
		// The response will be delivered over client.MessageChannel / serverMessageChan
	} else {
		FFZCodec.Send(conn, ClientMessage{
			MessageID: msg.MessageID,
			Command:   "error",
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

	client.Mutex.Lock()
	client.TwitchUsername = username
	client.UsernameValidated = false
	client.Mutex.Unlock()

	return ResponseSuccess, nil
}

func HandleSub(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	if err != nil {
		return
	}

	client.Mutex.Lock()

	AddToSliceS(&client.CurrentChannels, channel)
	client.PendingChatBacklogs = append(client.PendingChatBacklogs, channel)

	if client.MakePendingRequests == nil {
		client.MakePendingRequests = time.AfterFunc(ChannelInfoDelay, GetSubscriptionBacklogFor(conn, client))
	} else {
		if !client.MakePendingRequests.Reset(ChannelInfoDelay) {
			client.MakePendingRequests = time.AfterFunc(ChannelInfoDelay, GetSubscriptionBacklogFor(conn, client))
		}
	}

	client.Mutex.Unlock()

	SubscribeChat(client, channel)

	return ResponseSuccess, nil
}

func HandleUnsub(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	if err != nil {
		return
	}

	client.Mutex.Lock()
	RemoveFromSliceS(&client.CurrentChannels, channel)
	client.Mutex.Unlock()

	UnsubscribeSingleChat(client, channel)

	return ResponseSuccess, nil
}

func HandleSubChannel(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	if err != nil {
		return
	}

	client.Mutex.Lock()

	AddToSliceS(&client.WatchingChannels, channel)
	client.PendingStreamBacklogs = append(client.PendingStreamBacklogs, channel)

	if client.MakePendingRequests == nil {
		client.MakePendingRequests = time.AfterFunc(ChannelInfoDelay, GetSubscriptionBacklogFor(conn, client))
	} else {
		if !client.MakePendingRequests.Reset(ChannelInfoDelay) {
			client.MakePendingRequests = time.AfterFunc(ChannelInfoDelay, GetSubscriptionBacklogFor(conn, client))
		}
	}

	client.Mutex.Unlock()

	SubscribeWatching(client, channel)

	return ResponseSuccess, nil
}

func HandleUnsubChannel(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()

	if err != nil {
		return
	}

	client.Mutex.Lock()
	RemoveFromSliceS(&client.WatchingChannels, channel)
	client.Mutex.Unlock()

	UnsubscribeSingleChannel(client, channel)

	return ResponseSuccess, nil
}

func GetSubscriptionBacklogFor(conn *websocket.Conn, client *ClientInfo) func() {
	return func() {
		GetSubscriptionBacklog(conn, client)
	}
}

// On goroutine
func GetSubscriptionBacklog(conn *websocket.Conn, client *ClientInfo) {
	var chatSubs, channelSubs []string

	// Lock, grab the data, and reset it
	client.Mutex.Lock()
	chatSubs = client.PendingChatBacklogs
	channelSubs = client.PendingStreamBacklogs
	client.PendingChatBacklogs = nil
	client.PendingStreamBacklogs = nil
	client.MakePendingRequests = nil
	client.Mutex.Unlock()

	if len(chatSubs) == 0 && len(channelSubs) == 0 {
		return
	}

	if backendUrl == "" {
		return // for testing runs
	}
	messages, err := FetchBacklogData(chatSubs, channelSubs)

	if err != nil {
		// Oh well.
		log.Print("error in GetSubscriptionBacklog:", err)
		return
	}

	// Deliver to client
	for _, msg := range messages {
		client.MessageChannel <- msg
	}
}

type SurveySubmission struct {
	User string
	Json string
}

var SurveySubmissions []SurveySubmission
var SurveySubmissionLock sync.Mutex

func HandleSurvey(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	SurveySubmissionLock.Lock()
	SurveySubmissions = append(SurveySubmissions, SurveySubmission{client.TwitchUsername, msg.origArguments})
	SurveySubmissionLock.Unlock()

	return ResponseSuccess, nil
}

type FollowEvent struct {
	User         string
	Channel      string
	NowFollowing bool
	Timestamp    time.Time
}

var FollowEvents []FollowEvent
var FollowEventsLock sync.Mutex

func HandleTrackFollow(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, following, err := msg.ArgumentsAsStringAndBool()
	if err != nil {
		return
	}
	now := time.Now()

	FollowEventsLock.Lock()
	FollowEvents = append(FollowEvents, FollowEvent{client.TwitchUsername, channel, following, now})
	FollowEventsLock.Unlock()

	return ResponseSuccess, nil
}

var AggregateEmoteUsage map[int]map[string]int = make(map[int]map[string]int)
var AggregateEmoteUsageLock sync.Mutex

func HandleEmoticonUses(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	// arguments is [1]map[EmoteId]map[RoomName]float64

	mapRoot := msg.Arguments.([]interface{})[0].(map[string]interface{})

	AggregateEmoteUsageLock.Lock()
	defer AggregateEmoteUsageLock.Unlock()

	for strEmote, val1 := range mapRoot {
		var emoteId int
		emoteId, err = strconv.Atoi(strEmote)
		if err != nil {
			return
		}

		destMapInner, ok := AggregateEmoteUsage[emoteId]
		if !ok {
			destMapInner = make(map[string]int)
			AggregateEmoteUsage[emoteId] = destMapInner
		}

		mapInner := val1.(map[string]interface{})
		for roomName, val2 := range mapInner {
			var count int = int(val2.(float64))
			destMapInner[roomName] += count
		}
	}

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
