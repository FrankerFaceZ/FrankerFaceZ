package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"bitbucket.org/stendec/frankerfacez/socketserver/server"
	"github.com/clarkduvall/hyperloglog"
)

var _ = os.Exit

var configLocation = flag.String("config", "./config.json", "Location of the configuration file. Defaults to ./config.json")
var genConfig = flag.Bool("genconf", false, "Generate a new configuration file.")

var config ConfigFile

const ExitCodeBadConfig = 2

var allServers []*serverInfo

func main() {
	flag.Parse()

	if *genConfig {
		makeConfig()
		return
	}

	loadConfig()

	allServers = make([]*serverInfo, len(ServerNames))
	for i, v := range ServerNames {
		allServers[i] = &serverInfo{}
		allServers[i].Setup(v)
	}

	//printEveryDay()
	//os.Exit(0)
	http.HandleFunc("/api/get", ServeAPIGet)
	http.ListenAndServe(config.ListenAddr, http.DefaultServeMux)
}

func printEveryDay() {
	year := 2015
	month := 12
	day := 23
	filter := serverFilterAll
	var filter1, filter2, filter3 serverFilter
	filter1.Mode = serverFilterModeWhitelist
	filter2.Mode = serverFilterModeWhitelist
	filter3.Mode = serverFilterModeWhitelist
	filter1.Add(allServers[0].subdomain)
	filter2.Add(allServers[1].subdomain)
	filter3.Add(allServers[2].subdomain)
	stopTime := time.Now()
	var at time.Time
	const timeFmt = "2006-01-02"
	for ; stopTime.After(at); day++ {
		at = time.Date(year, time.Month(month), day, 0, 0, 0, 0, server.CounterLocation)
		hll, _ := hyperloglog.NewPlus(server.CounterPrecision)
		hll1, _ := hyperloglog.NewPlus(server.CounterPrecision)
		hll2, _ := hyperloglog.NewPlus(server.CounterPrecision)
		hll3, _ := hyperloglog.NewPlus(server.CounterPrecision)
		addSingleDate(at, filter, hll)
		addSingleDate(at, filter1, hll1)
		addSingleDate(at, filter2, hll2)
		addSingleDate(at, filter3, hll3)
		fmt.Printf("%s\t%d\t%d\t%d\t%d\n", at.Format(timeFmt), hll.Count(), hll1.Count(), hll2.Count(), hll3.Count())
	}
}

const RequestURIName = "q"
const separatorRange = "~"
const separatorAdd = " "
const separatorServer = "@"
const jsonErrMalformedRequest = `{"status":"error","error":"malformed request uri"}`
const jsonErrBlankRequest = `{"status":"error","error":"no queries given"}`
const statusError = "error"
const statusPartial = "partial"
const statusOk = "ok"

type apiResponse struct {
	Status    string            `json:"status"`
	Responses []requestResponse `json:"resp"`
}

type requestResponse struct {
	Status  string `json:"status"`
	Request string `json:"req"`
	Error   string `json:"error,omitempty"`
	Count   uint64 `json:"count,omitempty"`
}

func ServeAPIGet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	u, err := url.ParseRequestURI(r.RequestURI)
	if err != nil {
		w.WriteHeader(400)
		fmt.Fprint(w, jsonErrMalformedRequest)
		return
	}

	query := u.Query()
	reqCount := len(query[RequestURIName])
	if reqCount == 0 {
		w.WriteHeader(400)
		fmt.Fprint(w, jsonErrBlankRequest)
		return
	}

	resp := apiResponse{Status: statusOk}
	resp.Responses = make([]requestResponse, reqCount)
	for i, v := range query[RequestURIName] {
		if len(v) == 0 {
			continue
		}
		resp.Responses[i] = ProcessSingleGetRequest(v)
	}
	for _, v := range resp.Responses {
		if v.Status != statusOk {
			resp.Status = statusPartial
			break
		}
	}

	w.WriteHeader(200)
	enc := json.NewEncoder(w)
	enc.Encode(resp)
}

var errRangeFormatIncorrect = errors.New("incorrect range format, must be yyyy-mm-dd~yyyy-mm-dd")

// ProcessSingleGetRequest takes a request string and pulls the unique user data for the given dates and filters.
//
// The request string is in the following format:
//
//   Request = AddDateRanges [ "@" ServerFilter ] .
//   ServerFilter = [ "!" ] ServerName { " " ServerName } .
//   ServerName = { "a" … "z" } .
//   AddDateRanges = DateMaybeRange { " " DateMaybeRange } .
//   DateMaybeRange = DateRange | Date .
//   DateRange = Date "~" Date .
//   Date = Year "-" Month "-" Day .
//   Year = number number number number .
//   Month = number number .
//   Day = number number .
//   number = "0" … "9" .
//
// Example of a well-formed request:
//
//   2016-01-04~2016-01-08 2016-01-11~2016-01-15@andknuckles tuturu
//
// Remember that spaces are urlencoded as "+", so the HTTP request to send to retrieve that data would be this:
//
//   /api/get?q=2016-01-04~2016-01-08+2016-01-11~2016-01-15%40andknuckles+tuturu
//
// If a ServerFilter is specified, only users connecting to the specified servers will be included in the count.
//
// It does not matter if a date is specified multiple times, due to the data format used.
func ProcessSingleGetRequest(req string) (result requestResponse) {
	fmt.Println("processing request:", req)
	hll, _ := hyperloglog.NewPlus(server.CounterPrecision)

	result.Request = req
	result.Status = statusOk
	filter := serverFilterAll

	collectError := func(err error) bool {
		if err == ErrServerInFailedState {
			result.Status = statusPartial
			return false
		} else if err != nil {
			result.Status = statusError
			result.Error = err.Error()
			return true
		}
		return false
	}

	serverSplit := strings.Split(req, separatorServer)
	if len(serverSplit) == 2 {
		filter = serverFilterNone
		serversOnly := strings.Split(serverSplit[1], separatorAdd)
		for _, v := range serversOnly {
			filter.Add(v)
		}
	}

	addSplit := strings.Split(serverSplit[0], separatorAdd)

outerLoop:
	for _, split1 := range addSplit {
		if len(split1) == 0 {
			continue
		}

		rangeSplit := strings.Split(split1, separatorRange)
		if len(rangeSplit) == 1 {
			at, err := parseDateFromRequest(rangeSplit[0])
			if collectError(err) {
				break outerLoop
			}

			err = addSingleDate(at, filter, hll)
			if collectError(err) {
				break outerLoop
			}
		} else if len(rangeSplit) == 2 {
			from, err := parseDateFromRequest(rangeSplit[0])
			if collectError(err) {
				break outerLoop
			}
			to, err := parseDateFromRequest(rangeSplit[1])
			if collectError(err) {
				break outerLoop
			}

			err = addRange(from, to, filter, hll)
			if collectError(err) {
				break outerLoop
			}
		} else {
			collectError(errRangeFormatIncorrect)
			break outerLoop
		}
	}

	if result.Status == statusOk {
		result.Count = hll.Count()
	}
	return result
}

var errBadDate = errors.New("bad date format, must be yyyy-mm-dd")
var zeroTime = time.Unix(0, 0)

func parseDateFromRequest(dateStr string) (time.Time, error) {
	var year, month, day int
	n, err := fmt.Sscanf(dateStr, "%d-%d-%d", &year, &month, &day)
	if err != nil || n != 3 {
		return zeroTime, errBadDate
	}
	return time.Date(year, time.Month(month), day, 0, 0, 0, 0, server.CounterLocation), nil
}

type hllAndError struct {
	hll *hyperloglog.HyperLogLogPlus
	err error
}

func addSingleDate(at time.Time, filter serverFilter, dest *hyperloglog.HyperLogLogPlus) error {
	var partialErr error
	for _, si := range allServers {
		if filter.IsServerAllowed(si) {
			hll, err2 := si.GetHLL(at)
			if err2 == ErrServerInFailedState {
				partialErr = err2
			} else if err2 != nil {
				return err2
			} else {
				dest.Merge(hll)
			}
		}
	}
	return partialErr
}

func addRange(start time.Time, end time.Time, filter serverFilter, dest *hyperloglog.HyperLogLogPlus) error {
	end = server.TruncateToMidnight(end)
	year, month, day := start.Date()
	var partialErr error
	var myAllServers = make([]*serverInfo, 0, len(allServers))
	for _, si := range allServers {
		if filter.IsServerAllowed(si) {
			myAllServers = append(myAllServers, si)
		}
	}

	var ch = make(chan hllAndError)
	var wg sync.WaitGroup
	for current := start; current.Before(end); day = day + 1 {
		current = time.Date(year, month, day, 0, 0, 0, 0, server.CounterLocation)
		for _, si := range myAllServers {
			wg.Add(1)
			go getHLL(ch, si, current)
		}
	}

	go func() {
		wg.Wait()
		close(ch)
	}()

	for pair := range ch {
		wg.Done()
		hll, err := pair.hll, pair.err
		if err != nil {
			if partialErr == nil || partialErr == ErrServerInFailedState {
				partialErr = err
			}
		} else {
			dest.Merge(hll)
		}
	}

	return partialErr
}

func getHLL(ch chan hllAndError, si *serverInfo, at time.Time) {
	hll, err := si.GetHLL(at)
	ch <- hllAndError{hll: hll, err: err}
}
