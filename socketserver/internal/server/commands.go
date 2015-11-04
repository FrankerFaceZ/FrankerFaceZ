package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/satori/go.uuid"
	"log"
	"net/url"
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
		log.Println("[!] Unknown command", msg.Command, "- sent by client", client.ClientID, "@", conn.RemoteAddr())
		SendMessage(conn, ClientMessage{
			MessageID: msg.MessageID,
			Command:   "error",
			Arguments: fmt.Sprintf("Unknown command %s", msg.Command),
		})
		return
	}

	response, err := CallHandler(handler, conn, client, msg)

	if err == nil {
		if response.Command == AsyncResponseCommand {
			// Don't send anything
			// The response will be delivered over client.MessageChannel / serverMessageChan
		} else {
			response.MessageID = msg.MessageID
			SendMessage(conn, response)
		}
	} else {
		SendMessage(conn, ClientMessage{
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

	SubscribeGlobal(client)

	return ClientMessage{
		Arguments: client.ClientID.String(),
	}, nil
}

func HandleReady(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	disconnectAt, err := msg.ArgumentsAsInt()
	if err != nil {
		return
	}

	client.Mutex.Lock()
	if client.MakePendingRequests != nil {
		if !client.MakePendingRequests.Stop() {
			// Timer already fired, GetSubscriptionBacklog() has started
			rmsg.Command = SuccessCommand
			return
		}
	}
	client.PendingSubscriptionsBacklog = nil
	client.MakePendingRequests = nil
	client.Mutex.Unlock()

	client.MsgChannelKeepalive.Add(1)
	go func() {
		client.MessageChannel <- ClientMessage{MessageID: msg.MessageID, Command: SuccessCommand}
		SendBacklogForNewClient(client)
		if disconnectAt != 0 {
			SendTimedBacklogMessages(client, time.Unix(disconnectAt, 0))
		}
		client.MsgChannelKeepalive.Done()
	}()
	return ClientMessage{Command: AsyncResponseCommand}, nil
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
	client.PendingSubscriptionsBacklog = append(client.PendingSubscriptionsBacklog, channel)

	//	if client.MakePendingRequests == nil {
	//		client.MakePendingRequests = time.AfterFunc(ChannelInfoDelay, GetSubscriptionBacklogFor(conn, client))
	//	} else {
	//		if !client.MakePendingRequests.Reset(ChannelInfoDelay) {
	//			client.MakePendingRequests = time.AfterFunc(ChannelInfoDelay, GetSubscriptionBacklogFor(conn, client))
	//		}
	//	}

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

func GetSubscriptionBacklogFor(conn *websocket.Conn, client *ClientInfo) func() {
	return func() {
		GetSubscriptionBacklog(conn, client)
	}
}

// On goroutine
func GetSubscriptionBacklog(conn *websocket.Conn, client *ClientInfo) {
	var subs []string

	// Lock, grab the data, and reset it
	client.Mutex.Lock()
	subs = client.PendingSubscriptionsBacklog
	client.PendingSubscriptionsBacklog = nil
	client.MakePendingRequests = nil
	client.Mutex.Unlock()

	if len(subs) == 0 {
		return
	}

	if backendUrl == "" {
		return // for testing runs
	}
	messages, err := FetchBacklogData(subs)

	if err != nil {
		// Oh well.
		log.Print("error in GetSubscriptionBacklog:", err)
		return
	}

	// Deliver to client
	client.MsgChannelKeepalive.Add(1)
	if client.MessageChannel != nil {
		for _, msg := range messages {
			client.MessageChannel <- msg
		}
	}
	client.MsgChannelKeepalive.Done()
}

func HandleSurvey(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	// Discard
	return ResponseSuccess, nil
}

type FollowEvent struct {
	User         string    `json:u`
	Channel      string    `json:c`
	NowFollowing bool      `json:f`
	Timestamp    time.Time `json:t`
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
var ErrorNegativeEmoteUsage = errors.New("Emote usage count cannot be negative")

func HandleEmoticonUses(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	// arguments is [1]map[EmoteId]map[RoomName]float64

	mapRoot := msg.Arguments.([]interface{})[0].(map[string]interface{})

	for strEmote, val1 := range mapRoot {
		_, err = strconv.Atoi(strEmote)
		if err != nil {
			return
		}
		mapInner := val1.(map[string]interface{})
		for _, val2 := range mapInner {
			var count int = int(val2.(float64))
			if count <= 0 {
				err = ErrorNegativeEmoteUsage
				return
			}
		}
	}

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
			if count > 200 {
				count = 200
			}
			destMapInner[roomName] += count
		}
	}

	return ResponseSuccess, nil
}

func sendAggregateData() {
	for {
		time.Sleep(5 * time.Minute)
		DoSendAggregateData()
	}
}

func DoSendAggregateData() {
	FollowEventsLock.Lock()
	follows := FollowEvents
	FollowEvents = nil
	FollowEventsLock.Unlock()
	AggregateEmoteUsageLock.Lock()
	emoteUsage := AggregateEmoteUsage
	AggregateEmoteUsage = make(map[int]map[string]int)
	AggregateEmoteUsageLock.Unlock()

	reportForm := url.Values{}

	followJson, err := json.Marshal(follows)
	if err != nil {
		log.Print(err)
	} else {
		reportForm.Set("follows", string(followJson))
	}

	strEmoteUsage := make(map[string]map[string]int)
	for emoteId, usageByChannel := range emoteUsage {
		strEmoteId := strconv.Itoa(emoteId)
		strEmoteUsage[strEmoteId] = usageByChannel
	}
	emoteJson, err := json.Marshal(strEmoteUsage)
	if err != nil {
		log.Print(err)
	} else {
		reportForm.Set("emotes", string(emoteJson))
	}

	form, err := SealRequest(reportForm)
	if err != nil {
		log.Print(err)
		return
	}

	err = SendAggregatedData(form)
	if err != nil {
		log.Print(err)
		return
	}

	// done
}

type BunchedRequest struct {
	Command Command
	Param   string
}

func BunchedRequestFromCM(msg *ClientMessage) BunchedRequest {
	return BunchedRequest{Command: msg.Command, Param: msg.origArguments}
}

type BunchedResponse struct {
	Response  string
	Timestamp time.Time
}
type BunchSubscriber struct {
	Client    *ClientInfo
	MessageID int
}

type BunchSubscriberList struct {
	sync.Mutex
	Members []BunchSubscriber
}

var PendingBunchedRequests map[BunchedRequest]*BunchSubscriberList = make(map[BunchedRequest]*BunchSubscriberList)
var PendingBunchLock sync.Mutex
var CompletedBunchedRequests map[BunchedRequest]BunchedResponse = make(map[BunchedRequest]BunchedResponse)
var CompletedBunchLock sync.RWMutex

func bunchingJanitor() {
	for {
		time.Sleep(5 * time.Minute)
		keepIfAfter := time.Now().Add(-5 * time.Minute)
		CompletedBunchLock.Lock()
		for req, resp := range CompletedBunchedRequests {
			if !resp.Timestamp.After(keepIfAfter) {
				delete(CompletedBunchedRequests, req)
			}
		}
		CompletedBunchLock.Unlock()
	}
}

func HandleBunchedRemoteCommand(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	br := BunchedRequestFromCM(&msg)

	CompletedBunchLock.RLock()
	resp, ok := CompletedBunchedRequests[br]
	CompletedBunchLock.RUnlock()

	if ok && resp.Timestamp.After(time.Now().Add(-5*time.Minute)) {
		return SuccessMessageFromString(resp.Response), nil
	} else if ok {

		// Entry expired, let's remove it...
		CompletedBunchLock.Lock()
		// recheck condition
		resp, ok = CompletedBunchedRequests[br]
		if ok && !resp.Timestamp.After(time.Now().Add(-5*time.Minute)) {
			delete(CompletedBunchedRequests, br)
		}
		CompletedBunchLock.Unlock()
	}

	PendingBunchLock.Lock()
	list, ok := PendingBunchedRequests[br]
	if ok {
		list.Lock()
		AddToSliceB(&list.Members, client, msg.MessageID)
		list.Unlock()
		PendingBunchLock.Unlock()
		client.MsgChannelKeepalive.Add(1)

		return ClientMessage{Command: AsyncResponseCommand}, nil
	}

	PendingBunchedRequests[br] = &BunchSubscriberList{Members: []BunchSubscriber{{Client: client, MessageID: msg.MessageID}}}
	PendingBunchLock.Unlock()
	client.MsgChannelKeepalive.Add(1)

	go func(request BunchedRequest) {
		resp, err := RequestRemoteDataCached(string(request.Command), request.Param, AuthInfo{})

		PendingBunchLock.Lock() // Prevent new signups
		var msg ClientMessage
		if err == nil {
			CompletedBunchLock.Lock() // mutex on map
			CompletedBunchedRequests[request] = BunchedResponse{Response: resp, Timestamp: time.Now()}
			CompletedBunchLock.Unlock()

			msg = SuccessMessageFromString(resp)
		} else {
			msg.Command = ErrorCommand
			msg.Arguments = err.Error()
		}

		bsl := PendingBunchedRequests[request]
		bsl.Lock()
		for _, member := range bsl.Members {
			msg.MessageID = member.MessageID
			select {
			case member.Client.MessageChannel <- msg:
			case <-member.Client.MsgChannelIsDone:
			}
			member.Client.MsgChannelKeepalive.Done()
		}
		bsl.Unlock()

		delete(PendingBunchedRequests, request)
		PendingBunchLock.Unlock()
	}(br)

	return ClientMessage{Command: AsyncResponseCommand}, nil
}

func HandleRemoteCommand(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	client.MsgChannelKeepalive.Add(1)
	go func(conn *websocket.Conn, msg ClientMessage, authInfo AuthInfo) {
		resp, err := RequestRemoteDataCached(string(msg.Command), msg.origArguments, authInfo)

		if err != nil {
			client.MessageChannel <- ClientMessage{MessageID: msg.MessageID, Command: ErrorCommand, Arguments: err.Error()}
		} else {
			msg := ClientMessage{MessageID: msg.MessageID, Command: SuccessCommand, origArguments: resp}
			msg.parseOrigArguments()
			client.MessageChannel <- msg
		}
		client.MsgChannelKeepalive.Done()
	}(conn, msg, client.AuthInfo)

	return ClientMessage{Command: AsyncResponseCommand}, nil
}
