package main

import (
	"encoding/gob"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"bitbucket.org/stendec/frankerfacez/socketserver/server"
	"github.com/clarkduvall/hyperloglog"
	"github.com/hashicorp/golang-lru"
)

type serverFilter struct {
	// Mode is false for blacklist, true for whitelist
	Mode    bool
	Special []string
}

const serverFilterModeBlacklist = false
const serverFilterModeWhitelist = true

func (sf *serverFilter) IsServerAllowed(server *serverInfo) bool {
	name := server.subdomain
	for _, v := range sf.Special {
		if name == v {
			return sf.Mode
		}
	}
	return !sf.Mode
}

func (sf *serverFilter) Remove(server string) {
	if sf.Mode == serverFilterModeWhitelist {
		var idx int = -1
		for i, v := range sf.Special {
			if server == v {
				idx = i
				break
			}
		}
		if idx != -1 {
			var lenMinusOne = len(sf.Special) - 1
			sf.Special[idx] = sf.Special[lenMinusOne]
			sf.Special = sf.Special[:lenMinusOne]
		}
	} else {
		for _, v := range sf.Special {
			if server == v {
				return
			}
		}
		sf.Special = append(sf.Special, server)
	}
}

func (sf *serverFilter) Add(server string) {
	if sf.Mode == serverFilterModeBlacklist {
		var idx int = -1
		for i, v := range sf.Special {
			if server == v {
				idx = i
				break
			}
		}
		if idx != -1 {
			var lenMinusOne = len(sf.Special) - 1
			sf.Special[idx] = sf.Special[lenMinusOne]
			sf.Special = sf.Special[:lenMinusOne]
		}
	} else {
		for _, v := range sf.Special {
			if server == v {
				return
			}
		}
		sf.Special = append(sf.Special, server)
	}
}

var serverFilterAll serverFilter = serverFilter{Mode: serverFilterModeBlacklist}
var serverFilterNone serverFilter = serverFilter{Mode: serverFilterModeWhitelist}

func cannotCacheHLL(at time.Time) bool {
	now := time.Now()
	now.Add(-72 * time.Hour)
	return now.Before(at)
}

var ServerNames = []string{
	"catbag",
	"andknuckles",
	"tuturu",
}

var httpClient http.Client

const serverNameSuffix = ".frankerfacez.com"

const failedStateThreshold = 4

var ErrServerInFailedState = errors.New("server has been down recently and not recovered")
var ErrServerHasNoData = errors.New("no data for specified date")

type errServerNot200 struct {
	StatusCode int
	StatusText string
}

func (e *errServerNot200) Error() string {
	return fmt.Sprintf("The server responded with %d %s", e.StatusCode, e.StatusText)
}
func Not200Error(resp *http.Response) *errServerNot200 {
	return &errServerNot200{
		StatusCode: resp.StatusCode,
		StatusText: resp.Status,
	}
}

func getHLLCacheKey(at time.Time) string {
	year, month, day := at.Date()
	return fmt.Sprintf("%d-%d-%d", year, month, day)
}

type serverInfo struct {
	subdomain string

	memcache *lru.TwoQueueCache

	FailedState  bool
	FailureErr   error
	failureCount int

	lock sync.Mutex
}

func (si *serverInfo) Setup(subdomain string) {
	si.subdomain = subdomain
	tq, err := lru.New2Q(60)
	if err != nil {
		panic(err)
	}
	si.memcache = tq
}

// GetHLL gets the HLL from
func (si *serverInfo) GetHLL(at time.Time) (*hyperloglog.HyperLogLogPlus, error) {
	if cannotCacheHLL(at) {
		fmt.Println(at)
		err := si.ForceWrite()
		if err != nil {
			return nil, err
		}
		reader, err := si.DownloadHLL(at)
		if err != nil {
			return nil, err
		}
		fmt.Printf("downloaded uncached hll %s:%s\n", si.subdomain, getHLLCacheKey(at))
		defer si.DeleteHLL(at)
		return loadHLLFromStream(reader)
	}

	hll, ok := si.PeekHLL(at)
	if ok {
		fmt.Printf("got cached hll %s:%s\n", si.subdomain, getHLLCacheKey(at))
		return hll, nil
	}

	reader, err := si.OpenHLL(at)
	if err != nil {
		// continue to download
	} else {
		//fmt.Printf("opened hll %s:%s\n", si.subdomain, getHLLCacheKey(at))
		return loadHLLFromStream(reader)
	}

	reader, err = si.DownloadHLL(at)
	if err != nil {
		if err == ErrServerHasNoData {
			return hyperloglog.NewPlus(server.CounterPrecision)
		}
		return nil, err
	}
	fmt.Printf("downloaded hll %s:%s\n", si.subdomain, getHLLCacheKey(at))
	return loadHLLFromStream(reader)
}

func loadHLLFromStream(reader io.ReadCloser) (*hyperloglog.HyperLogLogPlus, error) {
	defer reader.Close()
	hll, _ := hyperloglog.NewPlus(server.CounterPrecision)
	dec := gob.NewDecoder(reader)
	err := dec.Decode(hll)
	if err != nil {
		return nil, err
	}
	return hll, nil
}

// PeekHLL tries to grab a HLL from the memcache without downloading it or hitting the disk.
func (si *serverInfo) PeekHLL(at time.Time) (*hyperloglog.HyperLogLogPlus, bool) {
	if cannotCacheHLL(at) {
		return nil, false
	}

	key := getHLLCacheKey(at)
	hll, ok := si.memcache.Get(key)
	if ok {
		return hll.(*hyperloglog.HyperLogLogPlus), true
	}

	return nil, false
}

func (si *serverInfo) DeleteHLL(at time.Time) {
	year, month, day := at.Date()
	filename := fmt.Sprintf("%s/%s/%d-%d-%d.gob", config.GobFilesLocation, si.subdomain, year, month, day)
	err := os.Remove(filename)
	if err != nil {
		fmt.Println(err)
	}
}

func (si *serverInfo) OpenHLL(at time.Time) (io.ReadCloser, error) {
	year, month, day := at.Date()
	filename := fmt.Sprintf("%s/%s/%d-%d-%d.gob", config.GobFilesLocation, si.subdomain, year, month, day)

	file, err := os.Open(filename)
	if err == nil {
		return file, nil
	}
	// file is nil
	if !os.IsNotExist(err) {
		return nil, err
	}

	return nil, os.ErrNotExist
}

func (si *serverInfo) DownloadHLL(at time.Time) (io.ReadCloser, error) {
	if si.FailedState {
		return nil, ErrServerInFailedState
	}
	si.lock.Lock()
	defer si.lock.Unlock()

	year, month, day := at.Date()
	url := fmt.Sprintf("https://%s/hll/daily-%d-%d-%d.gob", si.Domain(), day, month, year)
	resp, err := httpClient.Get(url)
	if err != nil {
		si.ServerFailed(err)
		return nil, err
	}
	if resp.StatusCode == 404 {
		return nil, ErrServerHasNoData
	}
	if resp.StatusCode != 200 {
		err = Not200Error(resp)
		si.ServerFailed(err)
		return nil, err
	}

	filename := fmt.Sprintf("%s/%s/%d-%d-%d.gob", config.GobFilesLocation, si.subdomain, year, month, day)
	file, err := os.OpenFile(filename, os.O_CREATE|os.O_EXCL|os.O_RDWR, 0644)
	if os.IsNotExist(err) {
		os.MkdirAll(fmt.Sprintf("%s/%s", config.GobFilesLocation, si.subdomain), 0755)
		file, err = os.OpenFile(filename, os.O_CREATE|os.O_EXCL|os.O_RDWR, 0644)
	}
	if err != nil {
		resp.Body.Close()
		return nil, fmt.Errorf("downloadhll: error opening file for writing: %v", err)
	}

	return &teeReadCloser{r: resp.Body, w: file}, nil
}

func (si *serverInfo) ForceWrite() error {
	if si.FailedState {
		return ErrServerInFailedState
	}

	url := fmt.Sprintf("https://%s/hll_force_write", si.Domain())
	resp, err := httpClient.Get(url)
	if err != nil {
		si.ServerFailed(err)
		return err
	}
	if resp.StatusCode != 200 {
		err = Not200Error(resp)
		si.ServerFailed(err)
		return err
	}
	resp.Body.Close()
	return nil
}

func (si *serverInfo) Domain() string {
	return fmt.Sprintf("%s%s", si.subdomain, serverNameSuffix)
}

func (si *serverInfo) ServerFailed(err error) {
	si.lock.Lock()
	defer si.lock.Unlock()
	si.failureCount++
	if si.failureCount > failedStateThreshold {
		fmt.Printf("Server %s entering failed state\n", si.subdomain)
		si.FailedState = true
		si.FailureErr = err
		go recoveryCheck(si)
	}
}

func recoveryCheck(si *serverInfo) {
	// TODO check for server recovery
}

type teeReadCloser struct {
	r io.ReadCloser
	w io.WriteCloser
}

func (t *teeReadCloser) Read(p []byte) (n int, err error) {
	n, err = t.r.Read(p)
	if n > 0 {
		if n, err := t.w.Write(p[:n]); err != nil {
			return n, err
		}
	}
	return
}

func (t *teeReadCloser) Close() error {
	err1 := t.r.Close()
	err2 := t.w.Close()
	if err1 != nil {
		return err1
	}
	return err2
}
