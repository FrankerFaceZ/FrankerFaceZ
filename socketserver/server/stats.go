package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"sync"
	"time"

	linuxproc "github.com/c9s/goprocinfo/linux"
)

type StatsData struct {
	updateMu sync.Mutex

	StatsDataVersion int

	StartTime time.Time
	Uptime    string
	BuildTime string
	BuildHash string

	CachedStatsLastUpdate time.Time

	Health struct {
		IRC     bool
		Backend map[string]time.Time
	}

	CurrentClientCount uint64
	LiveClientCount    uint64

	PubSubChannelCount int
	ResponseCacheItems int

	MemPerClientBytes uint64
	SysMemTotalKB     uint64
	SysMemFreeKB      uint64
	MemoryInUseKB     uint64
	MemoryRSSKB       uint64
	CpuUsagePct       float64

	ClientConnectsTotal    uint64
	ClientDisconnectsTotal uint64

	ClientVersions map[string]uint64

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
const StatsDataVersion = 8
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
		ClientVersions:    make(map[string]uint64),
		StatsDataVersion:  StatsDataVersion,
		Health: struct {
			IRC     bool
			Backend map[string]time.Time
		}{
			Backend: make(map[string]time.Time),
		},
	}
}

// SetBuildStamp should be called from the main package to identify the git build hash and build time.
func SetBuildStamp(buildTime, buildHash string) {
	Statistics.BuildTime = buildTime
	Statistics.BuildHash = buildHash
}

func updateStatsIfNeeded() {
	Statistics.updateMu.Lock()
	defer Statistics.updateMu.Unlock()

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

		Statistics.LiveClientCount = uint64(len(GlobalSubscriptionInfo))
		versions := make(map[string]uint64)
		for _, v := range GlobalSubscriptionInfo {
			versions[v.VersionString]++
		}
		Statistics.ClientVersions = versions

		GlobalSubscriptionLock.RUnlock()
	}

	{
		Statistics.Uptime = nowUpdate.Sub(Statistics.StartTime).String()
		Statistics.ResponseCacheItems = Backend.responseCache.ItemCount()
	}

	{
		Statistics.Health.IRC = authIrcConnection.Connected()
		Backend.lastSuccessLock.Lock()
		for k, v := range Backend.lastSuccess {
			Statistics.Health.Backend[k] = v
		}
		Backend.lastSuccessLock.Unlock()
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
func HTTPShowStatistics(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	updateStatsIfNeeded()

	jsonBytes, _ := json.Marshal(Statistics)
	outBuf := bytes.NewBuffer(nil)
	json.Indent(outBuf, jsonBytes, "", "\t")

	outBuf.WriteTo(w)
}

func HTTPShowStatisticsPrometheus(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

	updateStatsIfNeeded()

	Statistics.RenderPrometheus(w)
}

const (
	mGauge   = "gauge"
	mCounter = "counter"
)

func writeManualMetric(w io.Writer, name string, value float64, help, typ string) {
	fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s %s\n%s %v\n", name, help, name, typ, name, value)
}

func writeLabelledStart(w io.Writer, name string, help, typ string) {
	fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s %s\n", name, help, name, typ)
}

func writeLabelledValue(w io.Writer, name string, value float64, labelKey, labelValue string) {
	fmt.Fprintf(w, "%s{%s=%q} %v\n", name, labelKey, labelValue, value)
}

func boolToFloat64(v bool) float64 {
	if v {
		return 1
	}
	return 0
}

func (s *StatsData) RenderPrometheus(w io.Writer) {
	writeManualMetric(w, "process_start_time_seconds", float64(s.StartTime.Unix()), "Start time of the process since unix epoch in seconds.", mGauge)

	// build stamp
	writeLabelledStart(w, "frankerfacez_build_hash", "Compilation git version hash of the socket server.", mGauge)
	writeLabelledValue(w, "frankerfacez_build_hash", 1, "hash", s.BuildHash)
	writeLabelledStart(w, "frankerfacez_build_time", "Compilation timestamp of the socket server as a string.", mGauge)
	writeLabelledValue(w, "frankerfacez_build_time", 1, "time", s.BuildTime)

	writeManualMetric(w, "frankerfacez_health_irc", boolToFloat64(s.Health.IRC), "State of the Twitch IRC health checks.", mGauge)
	// todo: backend last seen

	// connections
	writeManualMetric(w, "frankerfacez_clients_current", float64(s.CurrentClientCount), "Number of current websocket connections to the socket server.", mGauge)
	writeManualMetric(w, "frankerfacez_clients_live", float64(s.LiveClientCount), "Number of live (completed handshake) websocket connections to the socket server.", mGauge)
	writeManualMetric(w, "frankerfacez_clients_connects_total", float64(s.ClientConnectsTotal), "Number of connections initiated to the socket server.", mCounter)
	writeManualMetric(w, "frankerfacez_clients_disconnects_total", float64(s.ClientConnectsTotal), "Number of connections to the socket server that have ended.", mCounter)

	writeManualMetric(w, "frankerfacez_pubsub_channels", float64(s.PubSubChannelCount), "Number of publish/subscribe channels the socket server knows about.", mGauge)
	writeManualMetric(w, "frankerfacez_pubsub_response_cache_items", float64(s.ResponseCacheItems), "Number of entries in the command response cache.", mGauge)

	// memory stats
	writeManualMetric(w, "frankerfacez_memory_per_client_bytes", float64(s.MemPerClientBytes), "Average number of bytes needed to serve a connection.", mGauge)
	writeManualMetric(w, "go_memstats_alloc_bytes", float64(s.MemoryInUseKB*1024), "Number of bytes allocated and still in use.", mGauge)
	writeManualMetric(w, "process_resident_memory_bytes", float64(s.MemoryRSSKB*1024), "Resident memory size in bytes.", mGauge)
	writeManualMetric(w, "system_total_memory_bytes", float64(s.SysMemTotalKB*1024), "Total amount of memory available on the system.", mGauge)
	writeManualMetric(w, "system_free_memory_bytes", float64(s.SysMemFreeKB*1024), "Total amount of free memory on the system.", mGauge)
	writeManualMetric(w, "process_cpu_recent_ratio", s.CpuUsagePct / 100, "Percentage of CPU time used since the last measurement.", mGauge)

	writeLabelledStart(w, "frankerfacez_client_versions", "Reported version of connected clients.", mGauge)
	for version, count := range s.ClientVersions {
		writeLabelledValue(w, "frankerfacez_client_versions", float64(count), "version", version)
	}

	writeLabelledStart(w, "frankerfacez_commands_issued", "Number of times each command has been issued.", mCounter)
	for command, count := range s.CommandsIssuedMap {
		writeLabelledValue(w, "frankerfacez_commands_issued", float64(count), "command", string(command))
	}
	writeManualMetric(w, "frankerfacez_commands_issued_total", float64(s.CommandsIssuedTotal), "Number of times each command has been issued.", mCounter)
	writeManualMetric(w, "frankerfacez_messages_sent_total", float64(s.MessagesSent), "Number of times the server has sent a message over the socket.", mCounter)

	writeManualMetric(w, "frankerfacez_backend_verify_fail_total", float64(s.BackendVerifyFails), "Number of times the server has failed to securely receive a message from the backend.", mCounter)

}
