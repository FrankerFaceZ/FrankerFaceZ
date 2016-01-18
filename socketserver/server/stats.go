package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"runtime"
	"sync"
	"time"

	linuxproc "github.com/c9s/goprocinfo/linux"
)

type StatsData struct {
	StatsDataVersion int

	StartTime time.Time
	Uptime    string
	BuildTime string
	BuildHash string

	CachedStatsLastUpdate time.Time

	CurrentClientCount uint64

	PubSubChannelCount int

	SysMemTotalKB uint64
	SysMemFreeKB  uint64
	MemoryInUseKB uint64
	MemoryRSSKB   uint64

	LowMemDroppedConnections uint64

	MemPerClientBytes uint64

	CpuUsagePct float64

	ClientConnectsTotal    uint64
	ClientDisconnectsTotal uint64

	DisconnectCodes map[string]uint64

	CommandsIssuedTotal uint64
	CommandsIssuedMap   map[Command]uint64

	MessagesSent uint64

	EmotesReportedTotal uint64

	BackendVerifyFails uint64

	// DisconnectReasons is at the bottom because it has indeterminate size
	DisconnectReasons map[string]uint64
}

// Statistics is several variables that get incremented during normal operation of the server.
// Its structure should be versioned as it is exposed via JSON.
//
// Note as to threaded access - this is soft/fun data and not critical to data integrity.
// Fix anything that -race turns up, but otherwise it's not too much of a problem.
var Statistics = newStatsData()

// CommandCounter is a channel for race-free counting of command usage.
var CommandCounter = make(chan Command, 10)

// commandCounter receives from the CommandCounter channel and uses the value to increment the values in Statistics.
// is_init_func
func commandCounter() {
	for cmd := range CommandCounter {
		Statistics.CommandsIssuedTotal++
		Statistics.CommandsIssuedMap[cmd]++
	}
}

// StatsDataVersion is the version of the StatsData struct.
const StatsDataVersion = 5
const pageSize = 4096

var cpuUsage struct {
	UserTime uint64
	SysTime  uint64
}

func newStatsData() *StatsData {
	return &StatsData{
		StartTime:         time.Now(),
		CommandsIssuedMap: make(map[Command]uint64),
		DisconnectCodes:   make(map[string]uint64),
		DisconnectReasons: make(map[string]uint64),
		StatsDataVersion:  StatsDataVersion,
	}
}

// SetBuildStamp should be called from the main package to identify the git build hash and build time.
func SetBuildStamp(buildTime, buildHash string) {
	Statistics.BuildTime = buildTime
	Statistics.BuildHash = buildHash
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

		Statistics.MemoryInUseKB = m.Alloc / 1024
	}

	{
		pstat, err := linuxproc.ReadProcessStat("/proc/self/stat")
		if err == nil {
			userTicks := pstat.Utime - cpuUsage.UserTime
			sysTicks := pstat.Stime - cpuUsage.SysTime
			cpuUsage.UserTime = pstat.Utime
			cpuUsage.SysTime = pstat.Stime

			Statistics.CpuUsagePct = 100 * float64(userTicks+sysTicks) / (timeDiff.Seconds() * float64(ticksPerSecond))
			Statistics.MemoryRSSKB = uint64(pstat.Rss * pageSize / 1024)
			Statistics.MemPerClientBytes = (Statistics.MemoryRSSKB * 1024) / (Statistics.CurrentClientCount + 1)
		}
		updateSysMem()
	}

	{
		ChatSubscriptionLock.RLock()
		Statistics.PubSubChannelCount = len(ChatSubscriptionInfo)
		ChatSubscriptionLock.RUnlock()

		GlobalSubscriptionLock.RLock()
		Statistics.CurrentClientCount = uint64(len(GlobalSubscriptionInfo))
		GlobalSubscriptionLock.RUnlock()
	}

	{
		Statistics.Uptime = nowUpdate.Sub(Statistics.StartTime).String()
	}
}

var sysMemLastUpdate time.Time
var sysMemUpdateLock sync.Mutex

// updateSysMem reads the system's available RAM.
func updateSysMem() {
	if time.Now().Add(-2 * time.Second).After(sysMemLastUpdate) {
		sysMemUpdateLock.Lock()
		defer sysMemUpdateLock.Unlock()
		if !time.Now().Add(-2 * time.Second).After(sysMemLastUpdate) {
			return
		}
	} else {
		return
	}
	sysMemLastUpdate = time.Now()
	memInfo, err := linuxproc.ReadMemInfo("/proc/meminfo")
	if err == nil {
		Statistics.SysMemTotalKB = memInfo.MemTotal
		Statistics.SysMemFreeKB = memInfo.MemAvailable
	}

	{
		writeHLL()
	}
}

// HTTPShowStatistics handles the /stats endpoint. It writes out the Statistics object as indented JSON.
func HTTPShowStatistics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	updateStatsIfNeeded()

	jsonBytes, _ := json.Marshal(Statistics)
	outBuf := bytes.NewBuffer(nil)
	json.Indent(outBuf, jsonBytes, "", "\t")

	outBuf.WriteTo(w)
}
