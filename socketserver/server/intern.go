package server

import (
	"sync"
)

type StringPool struct {
	sync.RWMutex
	lookup map[string]string
}

func NewStringPool() *StringPool {
	return &StringPool{lookup: make(map[string]string)}
}

// doesn't lock, doesn't check for dupes.
func (p *StringPool) _Intern_Setup(s string) {
	p.lookup[s] = s
}

func (p *StringPool) InternCommand(s string) Command {
	return Command(p.Intern(s))
}

func (p *StringPool) Intern(s string) string {
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
	ss = copyString(s)
	p.lookup[ss] = ss
	return ss
}
