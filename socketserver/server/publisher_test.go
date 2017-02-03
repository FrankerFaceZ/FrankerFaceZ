package server

import (
	"testing"
	"time"
)

func TestExpiredCleanup(t *testing.T) {
	const cmd = "test_command"
	const channel = "trihex"
	const channel2 = "twitch"
	const channel3 = "360chrism"
	const channel4 = "qa_partner"

	DumpBacklogData()
	defer DumpBacklogData()

	var zeroTime time.Time
	hourAgo := time.Now().Add(-1 * time.Hour)
	now := time.Now()
	hourFromNow := time.Now().Add(1 * time.Hour)

	saveLastMessage(cmd, channel, hourAgo, "1", false)
	saveLastMessage(cmd, channel2, now, "2", false)

	if len(CachedLastMessages) != 1 {
		t.Error("messages not saved")
	}
	if len(CachedLastMessages[cmd]) != 2 {
		t.Error("messages not saved")
	}

	time.Sleep(2 * time.Millisecond)

	cachedMessageJanitor_do()

	if len(CachedLastMessages) != 0 {
		t.Error("messages still present")
	}

	saveLastMessage(cmd, channel, hourAgo, "1", false)
	saveLastMessage(cmd, channel2, now, "2", false)
	saveLastMessage(cmd, channel3, hourFromNow, "3", false)
	saveLastMessage(cmd, channel4, zeroTime, "4", false)

	if len(CachedLastMessages[cmd]) != 4 {
		t.Error("messages not saved")
	}

	time.Sleep(2 * time.Millisecond)

	cachedMessageJanitor_do()

	if len(CachedLastMessages) != 1 {
		t.Error("messages not saved")
	}
	if len(CachedLastMessages[cmd]) != 2 {
		t.Error("messages not saved")
	}
	if CachedLastMessages[cmd][channel3].Data != "3" {
		t.Error("saved wrong message")
	}
	if CachedLastMessages[cmd][channel4].Data != "4" {
		t.Error("saved wrong message")
	}
}
