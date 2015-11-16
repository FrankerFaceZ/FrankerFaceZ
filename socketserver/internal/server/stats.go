package server

type StatsData struct {
	ClientConnectsTotal int64
	ClientDisconnectsTotal int64
	FirstNotHelloDisconnects int64

	DisconnectCodes map[int]int64
	DisconnectReasons map[string]int64

	CommandsIssuedTotal int64
	CommandsIssuedMap map[Command]int64

	MessagesSent int64
}

func newStatsData() *StatsData {
	return &StatsData{
		CommandsIssuedMap: make(map[Command]int64),
		DisconnectCodes: make(map[int]int64),
		DisconnectReasons: make(map[string]int64),
	}
}

// Statistics is several variables that get incremented during normal operation of the server.
var Statistics = newStatsData()
