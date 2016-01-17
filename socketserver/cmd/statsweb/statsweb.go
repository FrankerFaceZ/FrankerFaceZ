package main

import (
	"net/http"
	"flag"
	"github.com/clarkduvall/hyperloglog"
	"time"
	"bitbucket.org/stendec/frankerfacez/socketserver/server"
	"net/url"
	"fmt"
	"strings"
	"errors"
	"github.com/dustin/gojson"
)

var configLocation = flag.String("config", "./config.json", "Location of the configuration file. Defaults to ./config.json")
var genConfig = flag.Bool("genconf", false, "Generate a new configuration file.")

var config ConfigFile

const ExitCodeBadConfig = 2

func main() {
	flag.Parse()

	if *genConfig {
		makeConfig()
		return
	}

	loadConfig()

	http.HandleFunc("/api", ServeAPI)
	http.ListenAndServe(config.ListenAddr, http.DefaultServeMux)
}

const RequestURIName = "q"
const separatorRange = "~"
const separatorAdd = " "
const jsonErrMalformedRequest = `{"status":"error","error":"malformed request uri"}`
const jsonErrBlankRequest = `{"status":"error","error":"no queries given"}`
const statusError = "error"
const statusPartial = "partial"
const statusOk = "ok"
type apiResponse struct {
	Status string `json:"status"`
	Responses []requestResponse `json:"resp"`
}
type requestResponse struct {
	Status string `json:"status"`
	Request string `json:"req"`
	Error string `json:"error,omitempty"`
	Count uint64 `json:"count,omitempty"`
}

type serverFilter struct {
	// TODO
}
func (sf *serverFilter) IsServerAllowed(server string) {
	return true
}
const serverFilterAll serverFilter

func ServeAPI(w http.ResponseWriter, r *http.Request) {
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
		resp.Responses[i] = processSingleRequest(v)
	}
	for _, v := range resp.Responses {
		if v.Status == statusError {
			resp.Status = statusPartial
			break
		}
	}

	w.WriteHeader(200)
	enc := json.NewEncoder(w)
	enc.Encode(resp)
}

const errRangeFormatIncorrect = "incorrect range format, must be yyyy-mm-dd~yyyy-mm-dd"

func processSingleRequest(req string) (result requestResponse) {
	// Forms:
	// Single: 2016-01-02
	// Range: 2016-01-03~2016-01-09
	// Add disparate: 2016-01-02 2016-01-03 2016-01-09 2016-01-10
	// NOTE: Spaces are uri-encoded as +
	// Add ranges: 2016-01-04~2016-01-08 2016-01-11~2016-01-15
	var hll hyperloglog.HyperLogLogPlus, _ = hyperloglog.NewPlus(server.CounterPrecision)
	addSplit := strings.Split(req, separatorAdd)

	result.Request = req
	result.Status = statusOk

	outerLoop:
	for _, split1 := range addSplit {
		if len(split1) == 0 {
			continue
		}

		rangeSplit := strings.Split(split1, separatorRange)
		if len(rangeSplit) == 1 {
			at, err := parseDate(rangeSplit[0])
			if err != nil {
				result.Status = statusError
				result.Error = err.Error()
				break outerLoop
			}
			err = addSingleDate(at, serverFilterAll, &hll)
			if err != nil {
				result.Status = statusError
				result.Error = err.Error()
				break outerLoop
			}
		} else if len(rangeSplit) == 2 {
			from, err := parseDate(rangeSplit[0])
			if err != nil {
				result.Status = statusError
				result.Error = err.Error()
				break outerLoop
			}
			to, err := parseDate(rangeSplit[1])
			if err != nil {
				result.Status = statusError
				result.Error = err.Error()
				break outerLoop
			}
			err = addRange(from, to, serverFilterAll, &hll)
			if err != nil {
				result.Status = statusError
				result.Error = err.Error()
				break outerLoop
			}
		} else {
			result.Status = statusError
			result.Error = errRangeFormatIncorrect
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

func parseDate(dateStr string) (time.Time, error) {
	var year, month, day int
	n, err := fmt.Sscanf(dateStr, "%d-%d-%d", &year, &month, &day)
	if err != nil || n != 3 {
		return zeroTime, errBadDate
	}
	return time.Date(year, month, day, 0, 0, 0, 0, server.CounterLocation)
}

func addSingleDate(at time.Time, filter serverFilter, dest *hyperloglog.HyperLogLogPlus) error {
	// TODO
	return nil
}

func addRange(start time.Time, end time.Time, filter serverFilter, dest *hyperloglog.HyperLogLogPlus) error {

}

func combineDateRange(from time.Time, to time.Time, dest *hyperloglog.HyperLogLogPlus) error {
	from = server.TruncateToMidnight(from)
	to = server.TruncateToMidnight(to)
	year, month, day := from.Date()
	for current := from; current.Before(to); day = day + 1 {
		current = time.Date(year, month, day, 0, 0, 0, 0, server.CounterLocation)

	}
	return nil
}