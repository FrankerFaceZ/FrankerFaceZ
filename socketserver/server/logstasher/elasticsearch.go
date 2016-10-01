package logstasher

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// ID is a 128-bit ID for an elasticsearch document.
// Textually, it is base64-encoded.
// The Next() method increments the ID.
type ID struct {
	High uint64
	Low  uint64
}

// Text converts the ID into a base64 string.
func (id ID) String() string {
	var buf bytes.Buffer
	buf.Grow(21)
	enc := base64.NewEncoder(base64.StdEncoding, &buf)
	var bytes [16]byte
	binary.LittleEndian.PutUint64(bytes[0:8], id.High)
	binary.LittleEndian.PutUint64(bytes[8:16], id.Low)
	enc.Write(bytes[:])
	enc.Close()
	return buf.String()
}

// Next increments the ID and returns the prior state.
// Overflow is not checked because it's a uint64, do you really expect me to overflow that
func (id *ID) Next() ID {
	ret := ID{
		High: id.High,
		Low:  id.Low,
	}
	id.Low++
	return ret
}

var idPool = sync.Pool{New: func() interface{} {
	var bytes [16]byte
	n, err := rand.Reader.Read(bytes[:])
	if n != 16 || err != nil {
		panic(fmt.Errorf("Short read from crypto/rand: %v", err))
	}

	return &ID{
		High: binary.LittleEndian.Uint64(bytes[0:8]),
		Low:  binary.LittleEndian.Uint64(bytes[8:16]),
	}
}}

func ExampleID_Next() {
	id := idPool.Get().(*ID).Next()
	fmt.Println(id)
	idPool.Put(id)
}

// Report is the interface presented to the Submit() function.
// FillReport() is satisfied by ReportBasic, but ReportType must always be specified.
type Report interface {
	FillReport() error
	ReportType() string

	GetID() string
	GetTimestamp() time.Time
}

// ReportBasic is the essential fields of any report.
type ReportBasic struct {
	ID        string
	Timestamp time.Time
	Host      string
}

// FillReport sets the Host and Timestamp fields.
func (report *ReportBasic) FillReport() error {
	report.Host = hostMarker
	report.Timestamp = time.Now()
	id := idPool.Get().(*ID).Next()
	report.ID = id.String()
	idPool.Put(id)
	return nil
}

func (report *ReportBasic) GetID() string {
	return report.ID
}

func (report *ReportBasic) GetTimestamp() time.Time {
	return report.Timestamp
}

type ConnectionReport struct {
	ReportBasic

	ConnectTime    time.Time
	DisconnectTime time.Time
	// calculated
	ConnectionDuration time.Duration

	DisconnectCode   int
	DisconnectReason string

	UsernameWasValidated bool

	RemoteAddr     net.Addr `json:"-"` // not transmitted until I can figure out data minimization
	TwitchUsername string   `json:"-"` // also not transmitted
}

// FillReport sets all the calculated fields, and calls esReportBasic.FillReport().
func (report *ConnectionReport) FillReport() error {
	report.ReportBasic.FillReport()
	report.ConnectionDuration = report.DisconnectTime.Sub(report.ConnectTime)
	return nil
}

func (report *ConnectionReport) ReportType() string {
	return "conn"
}

var serverPresent bool
var esClient http.Client
var submitChan chan Report
var serverBase, indexPrefix, hostMarker string

func checkServerPresent() {
	if serverBase == "" {
		serverBase = "http://localhost:9200"
	}
	if indexPrefix == "" {
		indexPrefix = "sockreport"
	}

	urlHealth := fmt.Sprintf("%s/_cluster/health", serverBase)
	resp, err := esClient.Get(urlHealth)
	if err == nil {
		resp.Body.Close()
		serverPresent = true
		submitChan = make(chan Report, 8)
		fmt.Println("elasticsearch reports enabled")
		go submissionWorker()
	} else {
		serverPresent = false
	}
}

// Setup sets up the global variables for the package.
func Setup(ESServer, ESIndexPrefix, ESHostname string) {
	serverBase = ESServer
	indexPrefix = ESIndexPrefix
	hostMarker = ESHostname
	checkServerPresent()
}

// Submit inserts a report into elasticsearch (this is basically a manual logstash).
func Submit(report Report) {
	if !serverPresent {
		return
	}

	report.FillReport()
	submitChan <- report
}

func submissionWorker() {
	for report := range submitChan {
		time := report.GetTimestamp()
		rType := report.ReportType()

		// prefix-type-date
		indexName := fmt.Sprintf("%s-%s-%d-%d-%d", indexPrefix, rType, time.Year(), time.Month(), time.Day())
		// base/index/type/id
		putUrl, err := url.Parse(fmt.Sprintf("%s/%s/%s/%s", serverBase, indexName, rType, report.GetID()))
		if err != nil {
			panic(fmt.Errorf("logstash: cannot parse url: %v", err))
		}
		body, err := json.Marshal(report)
		if err != nil {
			panic(fmt.Errorf("logstash: cannot marshal json: %v", err))
		}

		req := &http.Request{
			Method: "PUT",
			URL:    putUrl,
			Body:   ioutil.NopCloser(bytes.NewReader(body)),
		}

		resp, err := esClient.Do(req)

		if err != nil {
			// ignore, the show must go on
		} else {
			io.Copy(ioutil.Discard, resp.Body)
			resp.Body.Close()
		}
	}
}
