package server

import (
	"time"
	"io"
)

// A RateLimit supports a constant number of Performed() calls every
// time a given unit of time passes.
//
// Calls to Performed() when no "action tokens" are available will block
// until one is available.
type RateLimit interface {
	// Run begins emitting tokens for the ratelimiter.
	// A call to Run must be followed by a call to Close.
	Run()
	// Performed consumes one token from the rate limiter.
	// If no tokens are available, the call will block until one is.
	Performed()
	// Close stops the rate limiter. Any future calls to Performed() will block forever.
	// Close never returns an error.
	io.Closer
}

type timeRateLimit struct{
	count  int
	period time.Duration
	ch     chan struct{}
	done   chan struct{}
}

// Construct a new RateLimit with the given count and duration.
func NewRateLimit(count int, period time.Duration) (RateLimit) {
	return &timeRateLimit{
		count:  count,
		period: period,
		ch:     make(chan struct{}),
		done:   make(chan struct{}),
	}
}

func (r *timeRateLimit) Run() {
	for {
		waiter := time.After(r.period)
		for i := 0; i < r.count; i++ {
			select {
			case r.ch <- struct{}{}:
				// ok
			case <-r.done:
				return
			}
		}
		<-waiter
	}
}

func (r *timeRateLimit) Performed() {
	<-r.ch
}

func (r *timeRateLimit) Close() error {
	close(r.done)
	return nil
}

type unlimited struct{}
var unlimitedInstance unlimited

// Unlimited returns a RateLimit that never blocks. The Run() and Close() calls are no-ops.
func Unlimited() (RateLimit) {
	return unlimitedInstance
}

func (r unlimited) Run() { }
func (r unlimited) Performed() { }
func (r unlimited) Close() error { return nil }
