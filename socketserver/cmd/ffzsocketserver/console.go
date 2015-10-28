package main

import (
	"../../internal/server"
	"fmt"
	"github.com/abiosoft/ishell"
	"runtime"
)

func commandLineConsole() {

	shell := ishell.NewShell()

	shell.Register("clientcount", func(args ...string) (string, error) {
		server.GlobalSubscriptionInfo.RLock()
		count := len(server.GlobalSubscriptionInfo.Members)
		server.GlobalSubscriptionInfo.RUnlock()
		return fmt.Sprintln(count, "clients connected"), nil
	})

	shell.Register("globalnotice", func(args ...string) (string, error) {
		msg := server.ClientMessage{
			MessageID: -1,
			Command:   "message",
			Arguments: args[0],
		}
		server.PublishToAll(msg)
		return "Message sent.", nil
	})

	shell.Register("memstatsbysize", func(args ...string) (string, error) {
		runtime.GC()

		m := runtime.MemStats{}
		runtime.ReadMemStats(&m)
		for _, val := range m.BySize {
			if val.Mallocs == 0 {
				continue
			}
			shell.Println(val.Size, "bytes:", val.Mallocs, "allocs", val.Frees, "frees")
		}
		shell.Println(m.NumGC, "collections occurred")
		return "", nil
	})

	shell.Start()
}
