package server

import (
	"bytes"
	"encoding/json"
	"net/http"
)

type StatsData struct {
	Version int

	CurrentClientCount int64

	ClientConnectsTotal    int64
	ClientDisconnectsTotal int64

	DisconnectCodes   map[string]int64

	CommandsIssuedTotal int64
	CommandsIssuedMap   map[Command]int64

	MessagesSent int64

	// DisconnectReasons is at the bottom because it has indeterminate size
	DisconnectReasons map[string]int64
}

const StatsDataVersion = 1

func newStatsData() *StatsData {
	return &StatsData{
		CommandsIssuedMap: make(map[Command]int64),
		DisconnectCodes:   make(map[string]int64),
		DisconnectReasons: make(map[string]int64),
		Version:           StatsDataVersion,
	}
}

// Statistics is several variables that get incremented during normal operation of the server.
// Its structure should be versioned as it is exposed via JSON.
var Statistics = newStatsData()

func HTTPShowStatistics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	jsonBytes, _ := json.Marshal(Statistics)
	outBuf := bytes.NewBuffer(nil)
	json.Indent(outBuf, jsonBytes, "", "\t")

	outBuf.WriteTo(w)
}
