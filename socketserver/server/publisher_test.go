package server

import (
	"testing"
	"time"
)

func TestCleanupBacklogMessages(t *testing.T) {

}

func TestFindFirstNewMessageEmpty(t *testing.T) {
	CachedGlobalMessages = []TimestampedGlobalMessage{}
	i := findFirstNewMessage(tgmarray(CachedGlobalMessages), time.Unix(10, 0))
	if i != -1 {
		t.Errorf("Expected -1, got %d", i)
	}
}
func TestFindFirstNewMessageOneBefore(t *testing.T) {
	CachedGlobalMessages = []TimestampedGlobalMessage{
		{Timestamp: time.Unix(8, 0)},
	}
	i := findFirstNewMessage(tgmarray(CachedGlobalMessages), time.Unix(10, 0))
	if i != -1 {
		t.Errorf("Expected -1, got %d", i)
	}
}
func TestFindFirstNewMessageSeveralBefore(t *testing.T) {
	CachedGlobalMessages = []TimestampedGlobalMessage{
		{Timestamp: time.Unix(1, 0)},
		{Timestamp: time.Unix(2, 0)},
		{Timestamp: time.Unix(3, 0)},
		{Timestamp: time.Unix(4, 0)},
		{Timestamp: time.Unix(5, 0)},
	}
	i := findFirstNewMessage(tgmarray(CachedGlobalMessages), time.Unix(10, 0))
	if i != -1 {
		t.Errorf("Expected -1, got %d", i)
	}
}
func TestFindFirstNewMessageInMiddle(t *testing.T) {
	CachedGlobalMessages = []TimestampedGlobalMessage{
		{Timestamp: time.Unix(1, 0)},
		{Timestamp: time.Unix(2, 0)},
		{Timestamp: time.Unix(3, 0)},
		{Timestamp: time.Unix(4, 0)},
		{Timestamp: time.Unix(5, 0)},
		{Timestamp: time.Unix(11, 0)},
		{Timestamp: time.Unix(12, 0)},
		{Timestamp: time.Unix(13, 0)},
		{Timestamp: time.Unix(14, 0)},
		{Timestamp: time.Unix(15, 0)},
	}
	i := findFirstNewMessage(tgmarray(CachedGlobalMessages), time.Unix(10, 0))
	if i != 5 {
		t.Errorf("Expected 5, got %d", i)
	}
}
func TestFindFirstNewMessageOneAfter(t *testing.T) {
	CachedGlobalMessages = []TimestampedGlobalMessage{
		{Timestamp: time.Unix(15, 0)},
	}
	i := findFirstNewMessage(tgmarray(CachedGlobalMessages), time.Unix(10, 0))
	if i != 0 {
		t.Errorf("Expected 0, got %d", i)
	}
}
func TestFindFirstNewMessageSeveralAfter(t *testing.T) {
	CachedGlobalMessages = []TimestampedGlobalMessage{
		{Timestamp: time.Unix(11, 0)},
		{Timestamp: time.Unix(12, 0)},
		{Timestamp: time.Unix(13, 0)},
		{Timestamp: time.Unix(14, 0)},
		{Timestamp: time.Unix(15, 0)},
	}
	i := findFirstNewMessage(tgmarray(CachedGlobalMessages), time.Unix(10, 0))
	if i != 0 {
		t.Errorf("Expected 0, got %d", i)
	}
}
