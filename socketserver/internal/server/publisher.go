package server

// This is the scariest code I've written yet for the server.
// If I screwed up the locking, I won't know until it's too late.

import (
	"sync"
	"time"
	"net/http"
)

type SubscriberList struct {
	sync.RWMutex
	Members []chan <- ClientMessage
}

var ChatSubscriptionInfo map[string]*SubscriberList
var ChatSubscriptionLock sync.RWMutex
var WatchingSubscriptionInfo map[string]*SubscriberList
var WatchingSubscriptionLock sync.RWMutex

func PublishToChat(channel string, msg ClientMessage) {
	ChatSubscriptionLock.RLock()
	list := ChatSubscriptionInfo[channel]
	if list != nil {
		list.RLock()
		for _, ch := range list.Members {
			ch <- msg
		}
		list.RUnlock()
	}
	ChatSubscriptionLock.RUnlock()
}

func PublishToWatchers(channel string, msg ClientMessage) {
	WatchingSubscriptionLock.RLock()
	list := WatchingSubscriptionInfo[channel]
	if list != nil {
		list.RLock()
		for _, ch := range list.Members {
			ch <- msg
		}
		list.RUnlock()
	}
	WatchingSubscriptionLock.RUnlock()
}

func HandlePublishRequest(w http.ResponseWriter, r *http.Request) {
	if r.TLS {
		PeerCertificates
	}
}

// Add a channel to the subscriptions while holding a read-lock to the map.
// Locks:
//   - ALREADY HOLDING a read-lock to the 'which' top-level map via the rlocker object
//   - possible write lock to the 'which' top-level map via the wlocker object
//   - write lock to SubscriptionInfo (if not creating new)
func _subscribeWhileRlocked(which map[string]*SubscriberList, channelName string, value chan <- ClientMessage, rlocker sync.Locker, wlocker sync.Locker) {
	list := which[channelName]
	if list == nil {
		// Not found, so create it
		rlocker.Unlock()
		wlocker.Lock()
		list = &SubscriberList{}
		list.Members = &[]chan <- ClientMessage{value} // Create it populated, to avoid reaper
		which[channelName] = list
		wlocker.Unlock()
		rlocker.Lock()
	} else {
		list.Lock()
		AddToSliceC(&list.Members, value)
		list.Unlock()
	}
}

// Locks:
//   - read lock to top-level maps
//   - possible write lock to top-level maps
//   - write lock to SubscriptionInfos
func SubscribeBatch(client *ClientInfo, chatSubs, channelSubs []string) {
	mchan := client.MessageChannel
	if len(chatSubs) > 0 {
		rlocker := ChatSubscriptionLock.RLocker()
		rlocker.Lock()
		for _, v := range chatSubs {
			_subscribeWhileRlocked(ChatSubscriptionInfo, v, mchan, rlocker, ChatSubscriptionLock)
		}
		rlocker.Unlock()
	}
	if len(channelSubs) > 0 {
		rlocker := WatchingSubscriptionLock.RLocker()
		rlocker.Lock()
		for _, v := range channelSubs {
			_subscribeWhileRlocked(WatchingSubscriptionInfo, v, mchan, rlocker, WatchingSubscriptionLock)
		}
		rlocker.Unlock()
	}
}

// Unsubscribe the client from all channels, AND clear the CurrentChannels / WatchingChannels fields.
// Locks:
//   - read lock to top-level maps
//   - write lock to SubscriptionInfos
//   - write lock to ClientInfo
func UnsubscribeAll(client *ClientInfo) {
	ChatSubscriptionLock.RLock()
	client.Mutex.Lock()
	for _, v := range client.CurrentChannels {
		list := ChatSubscriptionInfo[v]
		list.Lock()
		RemoveFromSliceC(&list.Members, client.MessageChannel)
		list.Unlock()
	}
	client.CurrentChannels = nil
	client.Mutex.Unlock()
	ChatSubscriptionLock.RUnlock()

	WatchingSubscriptionLock.RLock()
	client.Mutex.Lock()
	for _, v := range client.WatchingChannels {
		list := WatchingSubscriptionInfo[v]
		list.Lock()
		RemoveFromSliceC(&list.Members, client.MessageChannel)
		list.Unlock()
	}
	client.WatchingChannels = nil
	client.Mutex.Unlock()
	WatchingSubscriptionLock.RUnlock()
}

func UnsubscribeSingleChat(client *ClientInfo, channelName string) {
	ChatSubscriptionLock.RLock()
	list := ChatSubscriptionInfo[channelName]
	list.Lock()
	RemoveFromSliceC(&list.Members, client.MessageChannel)
	list.Unlock()
	ChatSubscriptionLock.RUnlock()
}

func UnsubscribeSingleChannel(client *ClientInfo, channelName string) {
	WatchingSubscriptionLock.RLock()
	list := WatchingSubscriptionInfo[channelName]
	list.Lock()
	RemoveFromSliceC(&list.Members, client.MessageChannel)
	list.Unlock()
	WatchingSubscriptionLock.RUnlock()
}

const ReapingDelay = 120 * time.Minute

// Checks each of ChatSubscriptionInfo / WatchingSubscriptionInfo
// for entries with no subscribers every ReapingDelay.
// Started from SetupServer().
func deadChannelReaper() {
	for {
		time.Sleep(ReapingDelay / 2)
		ChatSubscriptionLock.Lock()
		for key, val := range ChatSubscriptionInfo {
			if len(val.Members) == 0 {
				ChatSubscriptionInfo[key] = nil
			}
		}
		ChatSubscriptionLock.Unlock()
		time.Sleep(ReapingDelay / 2)
		WatchingSubscriptionLock.Lock()
		for key, val := range WatchingSubscriptionInfo {
			if len(val.Members) == 0 {
				WatchingSubscriptionInfo[key] = nil
			}
		}
	}
}