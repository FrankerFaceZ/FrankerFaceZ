package server

import (
	"log"
	"sync"
	"time"

	"github.com/FrankerFaceZ/FrankerFaceZ/socketserver/server/rate"
)

type SubscriberList struct {
	sync.RWMutex
	Members []*ClientInfo
}

var ChatSubscriptionInfo map[string]*SubscriberList = make(map[string]*SubscriberList)
var ChatSubscriptionLock sync.RWMutex
var GlobalSubscriptionInfo []*ClientInfo
var GlobalSubscriptionLock sync.RWMutex

func (client *ClientInfo) Send(msg ClientMessage) bool {
	select {
	case client.MessageChannel <- msg:
		return true
	case <-client.MsgChannelIsDone:
		return false
	default:
		// if we can't immediately send, ignore it
		return false
	}
}

func CountSubscriptions(channels []string) int {
	ChatSubscriptionLock.RLock()
	defer ChatSubscriptionLock.RUnlock()

	count := 0
	for _, channelName := range channels {
		list := ChatSubscriptionInfo[channelName]
		if list != nil {
			list.RLock()
			count += len(list.Members)
			list.RUnlock()
		}
	}

	return count
}

func SubscribeChannel(client *ClientInfo, channelName string) {
	ChatSubscriptionLock.RLock()
	_subscribeWhileRlocked(channelName, client)
	ChatSubscriptionLock.RUnlock()
}

func SubscribeGlobal(client *ClientInfo) {
	GlobalSubscriptionLock.Lock()
	AddToSliceCl(&GlobalSubscriptionInfo, client)
	GlobalSubscriptionLock.Unlock()
}

func PublishToChannel(channel string, msg ClientMessage, rl rate.Limiter) (count int) {
	var found []*ClientInfo

	ChatSubscriptionLock.RLock()
	list := ChatSubscriptionInfo[channel]
	if list != nil {
		list.RLock()
		found = make([]*ClientInfo, len(list.Members))
		copy(found, list.Members)
		list.RUnlock()
	}
	ChatSubscriptionLock.RUnlock()

	for _, cl := range found {
		rl.Performed()
		if cl.Send(msg) {
			count++
		}
	}
	return
}

func PublishToMultiple(channels []string, msg ClientMessage, rl rate.Limiter) (count int) {
	var found []*ClientInfo

	ChatSubscriptionLock.RLock()
	for _, channel := range channels {
		list := ChatSubscriptionInfo[channel]
		if list != nil {
			list.RLock()
			for _, cl := range list.Members {
				found = append(found, cl)
			}
			list.RUnlock()
		}
	}
	ChatSubscriptionLock.RUnlock()

	for _, cl := range found {
		rl.Performed()
		if cl.Send(msg) {
			count++
		}
	}
	return
}

func PublishToAll(msg ClientMessage, rl rate.Limiter) (count int) {
	var found []*ClientInfo

	GlobalSubscriptionLock.RLock()
	found = make([]*ClientInfo, len(GlobalSubscriptionInfo))
	copy(found, GlobalSubscriptionInfo)
	GlobalSubscriptionLock.RUnlock()

	for _, cl := range found {
		rl.Performed()
		if cl.Send(msg) {
			count++
		}
	}
	return
}

func UnsubscribeSingleChat(client *ClientInfo, channelName string) {
	ChatSubscriptionLock.RLock()
	list := ChatSubscriptionInfo[channelName]
	if list != nil {
		list.Lock()
		RemoveFromSliceCl(&list.Members, client)
		list.Unlock()
	}
	ChatSubscriptionLock.RUnlock()
}

// UnsubscribeAll will unsubscribe the client from all channels,
// AND clear the CurrentChannels / WatchingChannels fields.
//
// Locks:
//   - read lock to top-level maps
//   - write lock to SubscriptionInfos
//   - write lock to ClientInfo
func UnsubscribeAll(client *ClientInfo) {
	if StopAcceptingConnections {
		return // no need to remove from a high-contention list when the server is closing
	}

	GlobalSubscriptionLock.Lock()
	RemoveFromSliceCl(&GlobalSubscriptionInfo, client)
	GlobalSubscriptionLock.Unlock()

	ChatSubscriptionLock.RLock()
	client.Mutex.Lock()
	for _, v := range client.CurrentChannels {
		list := ChatSubscriptionInfo[v]
		if list != nil {
			list.Lock()
			RemoveFromSliceCl(&list.Members, client)
			list.Unlock()
		}
	}
	client.CurrentChannels = nil
	client.Mutex.Unlock()
	ChatSubscriptionLock.RUnlock()
}

func unsubscribeAllClients() {
	GlobalSubscriptionLock.Lock()
	GlobalSubscriptionInfo = nil
	GlobalSubscriptionLock.Unlock()
	ChatSubscriptionLock.Lock()
	ChatSubscriptionInfo = make(map[string]*SubscriberList)
	ChatSubscriptionLock.Unlock()
}

const ReapingDelay = 1 * time.Minute

// Checks ChatSubscriptionInfo for entries with no subscribers every ReapingDelay.
// is_init_func
func pubsubJanitor() {
	for {
		time.Sleep(ReapingDelay)
		pubsubJanitor_do()
	}
}

func pubsubJanitor_do() {
	var cleanedUp = make([]string, 0, 6)
	ChatSubscriptionLock.Lock()
	for key, val := range ChatSubscriptionInfo {
		if val == nil || len(val.Members) == 0 {
			delete(ChatSubscriptionInfo, key)
			cleanedUp = append(cleanedUp, key)
		}
	}
	ChatSubscriptionLock.Unlock()

	if len(cleanedUp) != 0 {
		err := Backend.SendCleanupTopicsNotice(cleanedUp)
		if err != nil {
			log.Println("error reporting cleaned subs:", err)
		}
	}
}

// Add a channel to the subscriptions while holding a read-lock to the map.
// Locks:
//   - ALREADY HOLDING a read-lock to the 'which' top-level map via the rlocker object
//   - possible write lock to the 'which' top-level map via the wlocker object
//   - write lock to SubscriptionInfo (if not creating new)
func _subscribeWhileRlocked(channelName string, value *ClientInfo) {
	list := ChatSubscriptionInfo[channelName]
	if list == nil {
		// Not found, so create it
		ChatSubscriptionLock.RUnlock()
		ChatSubscriptionLock.Lock()
		list = &SubscriberList{}
		list.Members = []*ClientInfo{value} // Create it populated, to avoid reaper
		ChatSubscriptionInfo[channelName] = list
		ChatSubscriptionLock.Unlock()

		go func(topic string) {
			err := Backend.SendNewTopicNotice(topic)
			if err != nil {
				log.Println("error reporting new sub:", err)
			}
		}(channelName)

		ChatSubscriptionLock.RLock()
	} else {
		list.Lock()
		AddToSliceCl(&list.Members, value)
		list.Unlock()
	}
}
