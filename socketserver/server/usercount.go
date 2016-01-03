package server

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/gob"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/clarkduvall/hyperloglog"
	"github.com/satori/go.uuid"
)

// uuidHash implements a hash for uuid.UUID by XORing the random bits.
type UuidHash uuid.UUID

func (u UuidHash) Sum64() uint64 {
	var valLow, valHigh uint64
	valLow = binary.LittleEndian.Uint64(u[0:8])
	valHigh = binary.LittleEndian.Uint64(u[8:16])
	return valLow ^ valHigh
}

type PeriodUniqueUsers struct {
	Start   time.Time
	End     time.Time
	Counter *hyperloglog.HyperLogLogPlus
}

type usageToken struct{}

const (
	periodDaily = iota
	periodWeekly
	periodMonthly
)

var periods [3]int = [3]int{periodDaily, periodWeekly, periodMonthly}

const uniqCountDir = "./uniques"
const usersDailyFmt = "daily-%d-%d-%d.gob"  // d-m-y
const usersWeeklyFmt = "weekly-%d-%d.gob"   // w-y
const usersMonthlyFmt = "monthly-%d-%d.gob" // m-y
const CounterPrecision uint8 = 12

var uniqueCounters [3]PeriodUniqueUsers
var uniqueUserChannel chan uuid.UUID
var uniqueCtrWritingToken chan usageToken

var counterLocation *time.Location = time.FixedZone("UTC-5", int((time.Hour*-5)/time.Second))

// getCounterPeriod calculates the start and end timestamps for the HLL measurement period that includes the 'at' timestamp.
func getCounterPeriod(which int, at time.Time) (start time.Time, end time.Time) {
	year, month, day := at.Date()

	switch which {
	case periodDaily:
		start = time.Date(year, month, day, 0, 0, 0, 0, counterLocation)
		end = time.Date(year, month, day+1, 0, 0, 0, 0, counterLocation)
	case periodWeekly:
		dayOffset := at.Weekday() - time.Sunday
		start = time.Date(year, month, day-int(dayOffset), 0, 0, 0, 0, counterLocation)
		end = time.Date(year, month, day-int(dayOffset)+7, 0, 0, 0, 0, counterLocation)
	case periodMonthly:
		start = time.Date(year, month, 1, 0, 0, 0, 0, counterLocation)
		end = time.Date(year, month+1, 1, 0, 0, 0, 0, counterLocation)
	}
	return start, end
}

// getHLLFilename returns the filename for the saved HLL whose measurement period covers the given time.
func getHLLFilename(which int, at time.Time) string {
	var filename string
	switch which {
	case periodDaily:
		year, month, day := at.Date()
		filename = fmt.Sprintf(usersDailyFmt, day, month, year)
	case periodWeekly:
		year, week := at.ISOWeek()
		filename = fmt.Sprintf(usersWeeklyFmt, week, year)
	case periodMonthly:
		year, month, _ := at.Date()
		filename = fmt.Sprintf(usersMonthlyFmt, month, year)
	}
	return fmt.Sprintf("%s/%s", uniqCountDir, filename)
}

// loadHLL loads a HLL from disk and stores the result in dest.Counter.
// If dest.Counter is nil, it will be initialized. (This is a useful side-effect.)
// If dest is one of the uniqueCounters, the usageToken must be held.
func loadHLL(which int, at time.Time, dest *PeriodUniqueUsers) error {
	fileBytes, err := ioutil.ReadFile(getHLLFilename(which, at))
	if err != nil {
		return err
	}

	if dest.Counter == nil {
		dest.Counter, _ = hyperloglog.NewPlus(CounterPrecision)
	}

	dec := gob.NewDecoder(bytes.NewReader(fileBytes))
	err = dec.Decode(dest.Counter)
	if err != nil {
		log.Panicln(err)
		return err
	}
	return nil
}

// writeHLL writes the indicated HLL to disk.
// The function takes the usageToken.
func writeHLL(which int) error {
	token := <-uniqueCtrWritingToken
	result := writeHLL_do(which)
	uniqueCtrWritingToken <- token
	return result
}

// writeHLL_do writes out the HLL indicated by `which` to disk.
// The usageToken must be held when calling this function.
func writeHLL_do(which int) error {
	counter := uniqueCounters[which]
	filename := getHLLFilename(which, counter.Start)
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	enc := gob.NewEncoder(file)
	enc.Encode(counter.Counter)
	return file.Close()
}

// readHLL reads the current value of the indicated HLL counter.
// The function takes the usageToken.
func readHLL(which int) uint64 {
	token := <-uniqueCtrWritingToken
	result := uniqueCounters[which].Counter.Count()
	uniqueCtrWritingToken <- token
	return result
}

// writeAllHLLs writes out all in-memory HLLs to disk.
// The function takes the usageToken.
func writeAllHLLs() error {
	var err, err2 error
	token := <-uniqueCtrWritingToken
	for _, period := range periods {
		err2 = writeHLL_do(period)
		if err == nil {
			err = err2
		}
	}
	uniqueCtrWritingToken <- token
	return err
}

var hllFileServer = http.StripPrefix("/hll", http.FileServer(http.Dir(uniqCountDir)))

func HTTPShowHLL(w http.ResponseWriter, r *http.Request) {
	hllFileServer.ServeHTTP(w, r)
}

func HTTPWriteHLL(w http.ResponseWriter, r *http.Request) {
	writeAllHLLs()
	w.WriteHeader(200)
	w.Write([]byte("ok"))
}

// loadUniqueUsers loads the previous HLLs into memory.
// is_init_func
func loadUniqueUsers() {
	gob.RegisterName("hyperloglog", hyperloglog.HyperLogLogPlus{})
	err := os.MkdirAll(uniqCountDir, 0755)
	if err != nil {
		log.Panicln("could not make unique users data dir:", err)
	}

	now := time.Now().In(counterLocation)
	for _, period := range periods {
		uniqueCounters[period].Start, uniqueCounters[period].End = getCounterPeriod(period, now)
		err := loadHLL(period, now, &uniqueCounters[period])
		if err != nil && os.IsNotExist(err) {
			// errors are bad precisions
			uniqueCounters[period].Counter, _ = hyperloglog.NewPlus(CounterPrecision)
		} else if err != nil && !os.IsNotExist(err) {
			log.Panicln("failed to load unique users data:", err)
		}
	}

	uniqueUserChannel = make(chan uuid.UUID)
	uniqueCtrWritingToken = make(chan usageToken)
	go processNewUsers()
	go rolloverCounters()
	uniqueCtrWritingToken <- usageToken{}
}

// dumpUniqueUsers dumps all the data in uniqueCounters.
func dumpUniqueUsers() {
	token := <-uniqueCtrWritingToken

	for _, period := range periods {
		uniqueCounters[period].Counter.Clear()
	}

	uniqueCtrWritingToken <- token
}

// processNewUsers reads uniqueUserChannel, and also dispatches the writing token.
// This function is the primary writer of uniqueCounters, so it makes sense for it to hold the token.
// is_init_func
func processNewUsers() {
	token := <-uniqueCtrWritingToken

	for {
		select {
		case u := <-uniqueUserChannel:
			hashed := UuidHash(u)
			for _, period := range periods {
				uniqueCounters[period].Counter.Add(hashed)
			}
		case uniqueCtrWritingToken <- token:
			// relinquish token. important that there is only one of this going on
			// otherwise we thrash
			token = <-uniqueCtrWritingToken
		}
	}
}

func getNextMidnight() time.Time {
	now := time.Now().In(counterLocation)
	year, month, day := now.Date()
	return time.Date(year, month, day+1, 0, 0, 1, 0, counterLocation)
}

// is_init_func
func rolloverCounters() {
	for {
		duration := getNextMidnight().Sub(time.Now())
		//	fmt.Println(duration)
		time.Sleep(duration)
		rolloverCounters_do()
	}
}

func rolloverCounters_do() {
	var token usageToken
	var now time.Time

	token = <-uniqueCtrWritingToken
	now = time.Now().In(counterLocation)
	for _, period := range periods {
		if now.After(uniqueCounters[period].End) {
			// Cycle for period
			err := writeHLL_do(period)
			if err != nil {
				log.Println("could not cycle unique user counter:", err)

				// Attempt to rescue the data into the log
				var buf bytes.Buffer
				bytes, err := uniqueCounters[period].Counter.GobEncode()
				if err == nil {
					enc := base64.NewEncoder(base64.StdEncoding, &buf)
					enc.Write(bytes)
					enc.Close()
					log.Print("data for ", getHLLFilename(period, now), ":", buf.String())
				}
			}

			uniqueCounters[period].Start, uniqueCounters[period].End = getCounterPeriod(period, now)
			// errors are bad precisions, so we can ignore
			uniqueCounters[period].Counter, _ = hyperloglog.NewPlus(CounterPrecision)
		}
	}

	uniqueCtrWritingToken <- token
}
