package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"runtime"
	"time"

	linuxproc "github.com/c9s/goprocinfo/linux"
)

type StatsData struct {
	Version int

	CurrentClientCount uint64

	ClientConnectsTotal    uint64
	ClientDisconnectsTotal uint64

	DisconnectCodes map[string]uint64

	CommandsIssuedTotal uint64
	CommandsIssuedMap   map[Command]uint64

	MessagesSent uint64

	CachedStatsLastUpdate time.Time

	MemoryInUse    uint64
	MemoryRSS int64

	CpuUsagePct float64

	// DisconnectReasons is at the bottom because it has indeterminate size
	DisconnectReasons map[string]uint64
}

// Statistics is several variables that get incremented during normal operation of the server.
// Its structure should be versioned as it is exposed via JSON.
var Statistics = newStatsData()

const StatsDataVersion = 2
const pageSize = 4096

var cpuUsage struct {
	UserTime uint64
	SysTime uint64
}

func newStatsData() *StatsData {
	return &StatsData{
		CommandsIssuedMap: make(map[Command]uint64),
		DisconnectCodes:   make(map[string]uint64),
		DisconnectReasons: make(map[string]uint64),
		Version:           StatsDataVersion,
	}
}

func updateStatsIfNeeded() {
	if time.Now().Add(-2 * time.Second).After(Statistics.CachedStatsLastUpdate) {
		updatePeriodicStats()
	}
}

func updatePeriodicStats() {
	nowUpdate := time.Now()
	timeDiff := nowUpdate.Sub(Statistics.CachedStatsLastUpdate)
	Statistics.CachedStatsLastUpdate = nowUpdate

	{
		m := runtime.MemStats{}
		runtime.ReadMemStats(&m)

		Statistics.MemoryInUse = m.Alloc
	}

	{
		pstat, err := linuxproc.ReadProcessStat("/proc/self/stat")
		if err == nil {
			userTicks := pstat.Utime - cpuUsage.UserTime
			sysTicks := pstat.Stime - cpuUsage.SysTime
			cpuUsage.UserTime = pstat.Utime
			cpuUsage.SysTime = pstat.Stime

			Statistics.CpuUsagePct = 100 * float64(userTicks + sysTicks) / (timeDiff.Seconds() * float64(ticksPerSecond))
			Statistics.MemoryRSS = pstat.Rss * pageSize
		}
	}
}

func HTTPShowStatistics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	updateStatsIfNeeded()

	jsonBytes, _ := json.Marshal(Statistics)
	outBuf := bytes.NewBuffer(nil)
	json.Indent(outBuf, jsonBytes, "", "\t")

	outBuf.WriteTo(w)
}
