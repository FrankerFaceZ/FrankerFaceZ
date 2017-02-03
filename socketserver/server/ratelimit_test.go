package server

import (
	"time"
	"testing"
)

var exampleData = []string{}

func ExampleNewRateLimit() {
	rl := NewRateLimit(100, 1*time.Minute)
	go rl.Run()
	defer rl.Close()

	for _, v := range exampleData {
		rl.Performed()
		// do something with v
		_ = v
	}
}

func TestRateLimit(t *testing.T) {
	rl := NewRateLimit(3, 100*time.Millisecond)
	start := time.Now()
	go rl.Run()
	for i := 0; i < 4; i++ {
		rl.Performed()
	}
	end := time.Now()
	if end.Sub(start) < 100*time.Millisecond {
		t.Error("ratelimiter did not wait for period to expire")
	}
	rl.Performed()
	rl.Performed()
	end2 := time.Now()
	if end2.Sub(end) > 10*time.Millisecond {
		t.Error("ratelimiter improperly waited when tokens were available")
	}
	rl.Close()
}