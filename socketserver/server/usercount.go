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

	"io"

	"github.com/clarkduvall/hyperloglog"
	"github.com/satori/go.uuid"
)

// UuidHash implements a hash for uuid.UUID by XORing the random bits.
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

const uniqCountDir = "./uniques"
const UsersDailyFmt = "daily-%d-%d-%d.gob" // d-m-y
const CounterPrecision uint8 = 12

var uniqueCounter PeriodUniqueUsers
var uniqueUserChannel chan uuid.UUID
var uniqueCtrWritingToken chan usageToken

var CounterLocation *time.Location = time.FixedZone("UTC-5", int((time.Hour*-5)/time.Second))

// GetCounterPeriod calculates the start and end timestamps for the HLL measurement period that includes the 'at' timestamp.
func GetCounterPeriod(at time.Time) (start time.Time, end time.Time) {
	year, month, day := at.Date()
	start = time.Date(year, month, day, 0, 0, 0, 0, CounterLocation)
	end = time.Date(year, month, day+1, 0, 0, 0, 0, CounterLocation)
	return start, end
}

// GetHLLFilename returns the filename for the saved HLL whose measurement period covers the given time.
func GetHLLFilename(at time.Time) string {
	var filename string
	year, month, day := at.Date()
	filename = fmt.Sprintf(UsersDailyFmt, day, month, year)
	return fmt.Sprintf("%s/%s", uniqCountDir, filename)
}

// loadHLL loads a HLL from disk and stores the result in dest.Counter.
// If dest.Counter is nil, it will be initialized. (This is a useful side-effect.)
// If dest is one of the uniqueCounters, the usageToken must be held.
func loadHLL(at time.Time, dest *PeriodUniqueUsers) error {
	fileBytes, err := ioutil.ReadFile(GetHLLFilename(at))
	if err != nil {
		return err
	}

	if dest.Counter == nil {
		dest.Counter, _ = hyperloglog.NewPlus(CounterPrecision)
	}

	dec := gob.NewDecoder(bytes.NewReader(fileBytes))
	err = dec.Decode(dest.Counter)
	if err != nil {
		return err
	}
	return nil
}

// writeHLL writes the indicated HLL to disk.
// The function takes the usageToken.
func writeHLL() error {
	token := <-uniqueCtrWritingToken
	result := writeHLL_do(&uniqueCounter)
	uniqueCtrWritingToken <- token
	return result
}

// writeHLL_do writes out the HLL indicated by `which` to disk.
// The usageToken must be held when calling this function.
func writeHLL_do(hll *PeriodUniqueUsers) (err error) {
	filename := GetHLLFilename(hll.Start)
	file, err := os.Create(filename)
	if err != nil {
		return err
	}

	defer func(file io.Closer) {
		fileErr := file.Close()
		if err == nil {
			err = fileErr
		}
	}(file)

	enc := gob.NewEncoder(file)
	return enc.Encode(hll.Counter)
}

// readCurrentHLL reads the current value of the active HLL counter.
// The function takes the usageToken.
func readCurrentHLL() uint64 {
	token := <-uniqueCtrWritingToken
	result := uniqueCounter.Counter.Count()
	uniqueCtrWritingToken <- token
	return result
}

var hllFileServer = http.StripPrefix("/hll", http.FileServer(http.Dir(uniqCountDir)))

func HTTPShowHLL(w http.ResponseWriter, r *http.Request) {
	hllFileServer.ServeHTTP(w, r)
}

func HTTPWriteHLL(w http.ResponseWriter, _ *http.Request) {
	writeHLL()
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

	now := time.Now().In(CounterLocation)
	uniqueCounter.Start, uniqueCounter.End = GetCounterPeriod(now)
	err = loadHLL(now, &uniqueCounter)
	isIgnorableError := err != nil && (os.IsNotExist(err) || err == io.EOF)

	if isIgnorableError {
		// file didn't finish writing
		// errors in NewPlus are bad precisions
		uniqueCounter.Counter, _ = hyperloglog.NewPlus(CounterPrecision)
		log.Println("failed to load unique users data:", err)
	} else if err != nil {
		log.Panicln("failed to load unique users data:", err)
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

	uniqueCounter.Counter.Clear()

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
			uniqueCounter.Counter.Add(hashed)
		case uniqueCtrWritingToken <- token:
			// relinquish token. important that there is only one of this going on
			// otherwise we thrash
			token = <-uniqueCtrWritingToken
		}
	}
}

func getNextMidnight() time.Time {
	now := time.Now().In(CounterLocation)
	year, month, day := now.Date()
	return time.Date(year, month, day+1, 0, 0, 1, 0, CounterLocation)
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
	now = time.Now().In(CounterLocation)
	// Cycle for period
	err := writeHLL_do(&uniqueCounter)
	if err != nil {
		log.Println("could not cycle unique user counter:", err)

		// Attempt to rescue the data into the log
		var buf bytes.Buffer
		by, err := uniqueCounter.Counter.GobEncode()
		if err == nil {
			enc := base64.NewEncoder(base64.StdEncoding, &buf)
			enc.Write(by)
			enc.Close()
			log.Print("data for ", GetHLLFilename(uniqueCounter.Start), ":", buf.String())
		}
	}

	uniqueCounter.Start, uniqueCounter.End = GetCounterPeriod(now)
	// errors are bad precisions, so we can ignore
	uniqueCounter.Counter, _ = hyperloglog.NewPlus(CounterPrecision)

	uniqueCtrWritingToken <- token
}
