package server

import (
	"sync"
)

type StringPool struct {
	sync.RWMutex
	lookup map[string]Command
}

func NewStringPool() *StringPool {
	return &StringPool{lookup: make(map[string]Command)}
}

// doesn't lock, doesn't check for dupes.
func (p *StringPool) _Intern_Setup(s string) {
	p.lookup[s] = Command(s)
}

func (p *StringPool) Intern(s string) Command {
	p.RLock()
	ss, exists := p.lookup[s]
	p.RUnlock()
	if exists {
		return ss
	}

	p.Lock()
	defer p.Unlock()
	ss, exists = p.lookup[s]
	if exists {
		return ss
	}
	ss = Command(string([]byte(s))) // make a copy
	p.lookup[s] = ss
	return ss
}
