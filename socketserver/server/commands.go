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

// Command is a string indicating which RPC is requested.
// The Commands sent from Client -> Server and Server -> Client are disjoint sets.
type Command string

// CommandHandler is a RPC handler associated with a Command.
type CommandHandler func(*websocket.Conn, *ClientInfo, ClientMessage) (ClientMessage, error)

var commandHandlers = map[Command]CommandHandler{
	HelloCommand:   C2SHello,
	"ping":         C2SPing,
	SetUserCommand: C2SSetUser,
	ReadyCommand:   C2SReady,

	"sub":   C2SSubscribe,
	"unsub": C2SUnsubscribe,

	"track_follow":  C2STrackFollow,
	"emoticon_uses": C2SEmoticonUses,
	"survey":        C2SSurvey,

	"twitch_emote":          C2SHandleBunchedCommand,
	"get_link":              C2SHandleBunchedCommand,
	"get_display_name":      C2SHandleBunchedCommand,
	"update_follow_buttons": C2SHandleRemoteCommand,
	"chat_history":          C2SHandleRemoteCommand,
	"user_history":          C2SHandleRemoteCommand,
}

func setupInterning() {
	PubSubChannelPool = NewStringPool()
	TwitchChannelPool = NewStringPool()

	CommandPool = NewStringPool()
	CommandPool._Intern_Setup(string(HelloCommand))
	CommandPool._Intern_Setup("ping")
	CommandPool._Intern_Setup(string(SetUserCommand))
	CommandPool._Intern_Setup(string(ReadyCommand))
	CommandPool._Intern_Setup("sub")
	CommandPool._Intern_Setup("unsub")
	CommandPool._Intern_Setup("track_follow")
	CommandPool._Intern_Setup("emoticon_uses")
	CommandPool._Intern_Setup("twitch_emote")
	CommandPool._Intern_Setup("get_link")
	CommandPool._Intern_Setup("get_display_name")
	CommandPool._Intern_Setup("update_follow_buttons")
	CommandPool._Intern_Setup("chat_history")
	CommandPool._Intern_Setup("user_history")
	CommandPool._Intern_Setup("adjacent_history")
}

// DispatchC2SCommand handles a C2S Command in the provided ClientMessage.
// It calls the correct CommandHandler function, catching panics.
// It sends either the returned Reply ClientMessage, setting the correct messageID, or sends an ErrorCommand
func DispatchC2SCommand(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) {
	handler, ok := commandHandlers[msg.Command]
	if !ok {
		handler = C2SHandleRemoteCommand
	}

	CommandCounter <- msg.Command

	response, err := callHandler(handler, conn, client, msg)

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
			Command:   ErrorCommand,
			Arguments: err.Error(),
		})
	}
}

func callHandler(handler CommandHandler, conn *websocket.Conn, client *ClientInfo, cmsg ClientMessage) (rmsg ClientMessage, err error) {
	defer func() {
		if r := recover(); r != nil {
			var ok bool
			fmt.Print("[!] Error executing command", cmsg.Command, "--", r)
			err, ok = r.(error)
			if !ok {
				err = fmt.Errorf("command handler: %v", r)
			}
		}
	}()
	return handler(conn, client, cmsg)
}

// C2SHello implements the `hello` C2S Command.
// It calls SubscribeGlobal() and SubscribeDefaults() with the client, and fills out ClientInfo.Version and ClientInfo.ClientID.
func C2SHello(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	version, clientID, err := msg.ArgumentsAsTwoStrings()
	if err != nil {
		return
	}

	client.VersionString = copyString(version)
	client.Version = VersionFromString(version)

	client.ClientID = uuid.FromStringOrNil(clientID)
	if client.ClientID == uuid.Nil {
		client.ClientID = uuid.NewV4()
	}

	uniqueUserChannel <- client.ClientID

	SubscribeGlobal(client)
	SubscribeDefaults(client)

	jsTime := float64(time.Now().UnixNano()/1000) / 1000
	return ClientMessage{
		Arguments: []interface{}{
			client.ClientID.String(),
			jsTime,
		},
	}, nil
}

func C2SPing(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	return ClientMessage{
		Arguments: float64(time.Now().UnixNano()/1000) / 1000,
	}, nil
}

func C2SSetUser(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	username, err := msg.ArgumentsAsString()
	if err != nil {
		return
	}

	username = copyString(username)

	client.Mutex.Lock()
	client.UsernameValidated = false
	client.TwitchUsername = username
	client.Mutex.Unlock()

	if Configuration.SendAuthToNewClients {
		client.MsgChannelKeepalive.Add(1)
		go client.StartAuthorization(func(_ *ClientInfo, _ bool) {
			client.MsgChannelKeepalive.Done()
		})
	}

	return ResponseSuccess, nil
}

func C2SReady(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	//	disconnectAt, err := msg.ArgumentsAsInt()
	//	if err != nil {
	//		return
	//	}

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
		client.MsgChannelKeepalive.Done()
	}()
	return ClientMessage{Command: AsyncResponseCommand}, nil
}

func C2SSubscribe(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()
	if err != nil {
		return
	}

	channel = PubSubChannelPool.Intern(channel)

	client.Mutex.Lock()
	AddToSliceS(&client.CurrentChannels, channel)
	if usePendingSubscrptionsBacklog {
		client.PendingSubscriptionsBacklog = append(client.PendingSubscriptionsBacklog, channel)
	}
	client.Mutex.Unlock()

	SubscribeChannel(client, channel)

	return ResponseSuccess, nil
}

// C2SUnsubscribe implements the `unsub` C2S Command.
// It removes the channel from ClientInfo.CurrentChannels and calls UnsubscribeSingleChat.
func C2SUnsubscribe(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, err := msg.ArgumentsAsString()
	if err != nil {
		return
	}

	channel = PubSubChannelPool.Intern(channel)

	client.Mutex.Lock()
	RemoveFromSliceS(&client.CurrentChannels, channel)
	client.Mutex.Unlock()

	UnsubscribeSingleChat(client, channel)

	return ResponseSuccess, nil
}

// C2SSurvey implements the survey C2S Command.
// Surveys are discarded.s
func C2SSurvey(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	// Discard
	return ResponseSuccess, nil
}

type followEvent struct {
	User         string    `json:"u"`
	Channel      string    `json:"c"`
	NowFollowing bool      `json:"f"`
	Timestamp    time.Time `json:"t"`
}

var followEvents []followEvent

// followEventsLock is the lock for followEvents.
var followEventsLock sync.Mutex

// C2STrackFollow implements the `track_follow` C2S Command.
// It adds the record to `followEvents`, which is submitted to the backend on a timer.
func C2STrackFollow(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	channel, following, err := msg.ArgumentsAsStringAndBool()
	if err != nil {
		return
	}
	now := time.Now()

	channel = TwitchChannelPool.Intern(channel)

	followEventsLock.Lock()
	followEvents = append(followEvents, followEvent{User: client.TwitchUsername, Channel: channel, NowFollowing: following, Timestamp: now})
	followEventsLock.Unlock()

	return ResponseSuccess, nil
}

// AggregateEmoteUsage is a map from emoteID to a map from chatroom name to usage count.
var aggregateEmoteUsage = make(map[int]map[string]int)

// AggregateEmoteUsageLock is the lock for AggregateEmoteUsage.
var aggregateEmoteUsageLock sync.Mutex

// ErrNegativeEmoteUsage is emitted when the submitted emote usage is negative.
var ErrNegativeEmoteUsage = errors.New("Emote usage count cannot be negative")

// C2SEmoticonUses implements the `emoticon_uses` C2S Command.
// msg.Arguments are in the JSON format of [1]map[emoteID]map[ChatroomName]float64.
func C2SEmoticonUses(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	// if this panics, will be caught by callHandler
	mapRoot := msg.Arguments.([]interface{})[0].(map[string]interface{})

	// Validate: male suire
	for strEmote, val1 := range mapRoot {
		_, err = strconv.Atoi(strEmote)
		if err != nil {
			return
		}
		mapInner := val1.(map[string]interface{})
		for _, val2 := range mapInner {
			var count = int(val2.(float64))
			if count <= 0 {
				err = ErrNegativeEmoteUsage
				return
			}
		}
	}

	aggregateEmoteUsageLock.Lock()
	defer aggregateEmoteUsageLock.Unlock()

	var total int

	for strEmote, val1 := range mapRoot {
		var emoteID int
		emoteID, err = strconv.Atoi(strEmote)
		if err != nil {
			return
		}

		destMapInner, ok := aggregateEmoteUsage[emoteID]
		if !ok {
			destMapInner = make(map[string]int)
			aggregateEmoteUsage[emoteID] = destMapInner
		}

		mapInner := val1.(map[string]interface{})
		for roomName, val2 := range mapInner {
			var count = int(val2.(float64))
			if count > 200 {
				count = 200
			}
			roomName = TwitchChannelPool.Intern(roomName)
			destMapInner[roomName] += count
			total += count
		}
	}

	Statistics.EmotesReportedTotal += uint64(total)

	return ResponseSuccess, nil
}

// is_init_func
func aggregateDataSender() {
	for {
		time.Sleep(5 * time.Minute)
		aggregateDataSender_do()
	}
}

func aggregateDataSender_do() {
	followEventsLock.Lock()
	follows := followEvents
	followEvents = nil
	followEventsLock.Unlock()
	aggregateEmoteUsageLock.Lock()
	emoteUsage := aggregateEmoteUsage
	aggregateEmoteUsage = make(map[int]map[string]int)
	aggregateEmoteUsageLock.Unlock()

	reportForm := url.Values{}

	followJSON, err := json.Marshal(follows)
	if err != nil {
		log.Println("error reporting aggregate data:", err)
	} else {
		reportForm.Set("follows", string(followJSON))
	}

	strEmoteUsage := make(map[string]map[string]int)
	for emoteID, usageByChannel := range emoteUsage {
		strEmoteID := strconv.Itoa(emoteID)
		strEmoteUsage[strEmoteID] = usageByChannel
	}
	emoteJSON, err := json.Marshal(strEmoteUsage)
	if err != nil {
		log.Println("error reporting aggregate data:", err)
	} else {
		reportForm.Set("emotes", string(emoteJSON))
	}

	form, err := SealRequest(reportForm)
	if err != nil {
		log.Println("error reporting aggregate data:", err)
		return
	}

	err = SendAggregatedData(form)
	if err != nil {
		log.Println("error reporting aggregate data:", err)
		return
	}

	// done
}

type bunchedRequest struct {
	Command Command
	Param   string
}

type cachedBunchedResponse struct {
	Response  string
	Timestamp time.Time
}
type bunchSubscriber struct {
	Client    *ClientInfo
	MessageID int
}

type bunchSubscriberList struct {
	sync.Mutex
	Members []bunchSubscriber
}

type cacheStatus byte

const (
	CacheStatusNotFound = iota
	CacheStatusFound
	CacheStatusExpired
)

var pendingBunchedRequests = make(map[bunchedRequest]*bunchSubscriberList)
var pendingBunchLock sync.Mutex
var bunchCache = make(map[bunchedRequest]cachedBunchedResponse)
var bunchCacheLock sync.RWMutex
var bunchCacheCleanupSignal = sync.NewCond(&bunchCacheLock)
var bunchCacheLastCleanup time.Time

func bunchedRequestFromCM(msg *ClientMessage) bunchedRequest {
	return bunchedRequest{Command: msg.Command, Param: copyString(msg.origArguments)}
}

// is_init_func
func bunchCacheJanitor() {
	go func() {
		for {
			time.Sleep(30 * time.Minute)
			bunchCacheCleanupSignal.Signal()
		}
	}()

	bunchCacheLock.Lock()
	for {
		// Unlocks CachedBunchLock, waits for signal, re-locks
		bunchCacheCleanupSignal.Wait()

		if bunchCacheLastCleanup.After(time.Now().Add(-1 * time.Second)) {
			// skip if it's been less than 1 second
			continue
		}

		// CachedBunchLock is held here
		keepIfAfter := time.Now().Add(-5 * time.Minute)
		for req, resp := range bunchCache {
			if !resp.Timestamp.After(keepIfAfter) {
				delete(bunchCache, req)
			}
		}
		bunchCacheLastCleanup = time.Now()
		// Loop and Wait(), which re-locks
	}
}

var emptyCachedBunchedResponse cachedBunchedResponse

func bunchGetCacheStatus(br bunchedRequest, client *ClientInfo) (cacheStatus, cachedBunchedResponse) {
	bunchCacheLock.RLock()
	defer bunchCacheLock.RUnlock()
	cachedResponse, ok := bunchCache[br]
	if ok && cachedResponse.Timestamp.After(time.Now().Add(-5*time.Minute)) {
		return CacheStatusFound, cachedResponse
	} else if ok {
		return CacheStatusExpired, emptyCachedBunchedResponse
	}
	return CacheStatusNotFound, emptyCachedBunchedResponse
}

func normalizeBunchedRequest(br bunchedRequest) bunchedRequest {
	if br.Command == "get_link" {
		// TODO
	}
	return br
}

// C2SHandleBunchedCommand handles C2S Commands such as `get_link`.
// It makes a request to the backend server for the data, but any other requests coming in while the first is pending also get the responses from the first one.
// Additionally, results are cached.
func C2SHandleBunchedCommand(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	// FIXME(riking): Function is too complex

	br := bunchedRequestFromCM(&msg)
	br = normalizeBunchedRequest(br)

	cacheStatus, cachedResponse := bunchGetCacheStatus(br, client)

	if cacheStatus == CacheStatusFound {
		var response ClientMessage
		response.Command = SuccessCommand
		response.MessageID = msg.MessageID
		response.origArguments = cachedResponse.Response
		response.parseOrigArguments()

		return response, nil
	} else if cacheStatus == CacheStatusExpired {
		// Wake up the lazy janitor
		bunchCacheCleanupSignal.Signal()
	}

	pendingBunchLock.Lock()
	defer pendingBunchLock.Unlock()
	list, ok := pendingBunchedRequests[br]
	if ok {
		list.Lock()
		AddToSliceB(&list.Members, client, msg.MessageID)
		list.Unlock()

		return ClientMessage{Command: AsyncResponseCommand}, nil
	}

	pendingBunchedRequests[br] = &bunchSubscriberList{Members: []bunchSubscriber{{Client: client, MessageID: msg.MessageID}}}

	go func(request bunchedRequest) {
		respStr, err := SendRemoteCommandCached(string(request.Command), request.Param, AuthInfo{})

		var msg ClientMessage
		if err == nil {
			msg.Command = SuccessCommand
			msg.origArguments = respStr
			msg.parseOrigArguments()
		} else {
			msg.Command = ErrorCommand
			msg.Arguments = err.Error()
		}

		if err == nil {
			bunchCacheLock.Lock()
			bunchCache[request] = cachedBunchedResponse{Response: respStr, Timestamp: time.Now()}
			bunchCacheLock.Unlock()
		}

		pendingBunchLock.Lock()
		bsl := pendingBunchedRequests[request]
		delete(pendingBunchedRequests, request)
		pendingBunchLock.Unlock()

		bsl.Lock()
		for _, member := range bsl.Members {
			msg.MessageID = member.MessageID
			select {
			case member.Client.MessageChannel <- msg:
			case <-member.Client.MsgChannelIsDone:
			}
		}
		bsl.Unlock()
	}(br)

	return ClientMessage{Command: AsyncResponseCommand}, nil
}

func C2SHandleRemoteCommand(conn *websocket.Conn, client *ClientInfo, msg ClientMessage) (rmsg ClientMessage, err error) {
	client.MsgChannelKeepalive.Add(1)
	go doRemoteCommand(conn, msg, client)

	return ClientMessage{Command: AsyncResponseCommand}, nil
}

const AuthorizationFailedErrorString = "Failed to verify your Twitch username."
const AuthorizationNeededError = "You must be signed in to use that command."

func doRemoteCommand(conn *websocket.Conn, msg ClientMessage, client *ClientInfo) {
	resp, err := SendRemoteCommandCached(string(msg.Command), copyString(msg.origArguments), client.AuthInfo)

	if err == ErrAuthorizationNeeded {
		if client.TwitchUsername == "" {
			// Not logged in
			client.MessageChannel <- ClientMessage{MessageID: msg.MessageID, Command: ErrorCommand, Arguments: AuthorizationNeededError}
			client.MsgChannelKeepalive.Done()
			return
		}
		client.StartAuthorization(func(_ *ClientInfo, success bool) {
			if success {
				doRemoteCommand(conn, msg, client)
			} else {
				client.MessageChannel <- ClientMessage{MessageID: msg.MessageID, Command: ErrorCommand, Arguments: AuthorizationFailedErrorString}
				client.MsgChannelKeepalive.Done()
			}
		})
		return // without keepalive.Done()
	} else if bfe, ok := err.(ErrForwardedFromBackend); ok {
		client.MessageChannel <- ClientMessage{MessageID: msg.MessageID, Command: ErrorCommand, Arguments: bfe.JSONError}
	} else if err != nil {
		client.MessageChannel <- ClientMessage{MessageID: msg.MessageID, Command: ErrorCommand, Arguments: err.Error()}
	} else {
		msg := ClientMessage{MessageID: msg.MessageID, Command: SuccessCommand, origArguments: resp}
		msg.parseOrigArguments()
		client.MessageChannel <- msg
	}
	client.MsgChannelKeepalive.Done()
}
