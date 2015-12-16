package server

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"
)

const (
	SetupWantSocketServer = 1 << iota
	SetupWantBackendServer
	SetupWantURLs
)
const SetupNoServers = 0

func TSetup(flags int, backendChecker *TBackendRequestChecker) (socketserver *httptest.Server, backend *httptest.Server, urls TURLs) {
	DumpBacklogData()

	ioutil.WriteFile("index.html", []byte(`
<!DOCTYPE html>
<title>CatBag</title>
<link rel="stylesheet" href="//cdn.frankerfacez.com/script/catbag.css">
<div id="container">
<div id="zf0"></div><div id="zf1"></div><div id="zf2"></div>
<div id="zf3"></div><div id="zf4"></div><div id="zf5"></div>
<div id="zf6"></div><div id="zf7"></div><div id="zf8"></div>
<div id="zf9"></div><div id="catbag"></div>
<div id="bottom">
	A <a href="http://www.frankerfacez.com/">FrankerFaceZ</a> Service
	&mdash; CatBag by <a href="http://www.twitch.tv/wolsk">Wolsk</a>
</div>
</div>`), 0600)

	conf := &ConfigFile{
		ServerID:         20,
		UseSSL:           false,
		OurPublicKey:     []byte{176, 149, 72, 209, 35, 42, 110, 220, 22, 236, 212, 129, 213, 199, 1, 227, 185, 167, 150, 159, 117, 202, 164, 100, 9, 107, 45, 141, 122, 221, 155, 73},
		OurPrivateKey:    []byte{247, 133, 147, 194, 70, 240, 211, 216, 223, 16, 241, 253, 120, 14, 198, 74, 237, 180, 89, 33, 146, 146, 140, 58, 88, 160, 2, 246, 112, 35, 239, 87},
		BackendPublicKey: []byte{19, 163, 37, 157, 50, 139, 193, 85, 229, 47, 166, 21, 153, 231, 31, 133, 41, 158, 8, 53, 73, 0, 113, 91, 13, 181, 131, 248, 176, 18, 1, 107},
	}

	if flags&SetupWantBackendServer != 0 {
		backend = httptest.NewServer(backendChecker)
		conf.BackendURL = fmt.Sprintf("http://%s", backend.Listener.Addr().String())
	}

	Configuration = conf
	setupBackend(conf)

	if flags&SetupWantSocketServer != 0 {
		serveMux := http.NewServeMux()
		SetupServerAndHandle(conf, serveMux)

		socketserver = httptest.NewServer(serveMux)
	}

	if flags&SetupWantURLs != 0 {
		urls = TGetUrls(socketserver, backend)
	}
	return
}

type TBC interface {
	Error(args ...interface{})
	Errorf(format string, args ...interface{})
}

const MethodIsPost = "POST"

type TExpectedBackendRequest struct {
	ResponseCode int
	Path         string
	// Method       string // always POST
	PostForm        *url.Values
	Response        string
	ResponseHeaders http.Header
}

func (er *TExpectedBackendRequest) String() string {
	if MethodIsPost == "" {
		return er.Path
	}
	return fmt.Sprint("%s %s: %s", MethodIsPost, er.Path, er.PostForm.Encode())
}

type TBackendRequestChecker struct {
	ExpectedRequests []TExpectedBackendRequest

	currentRequest int
	tb             TBC
}

func NewTBackendRequestChecker(tb TBC, urls ...TExpectedBackendRequest) *TBackendRequestChecker {
	return &TBackendRequestChecker{ExpectedRequests: urls, tb: tb, currentRequest: 0}
}

func (backend *TBackendRequestChecker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != MethodIsPost {
		backend.tb.Errorf("Bad backend request: was not a POST. %v", r)
		return
	}

	r.ParseForm()

	unsealedForm, err := UnsealRequest(r.PostForm)
	if err != nil {
		backend.tb.Errorf("Failed to unseal backend request: %v", err)
	}

	if backend.currentRequest >= len(backend.ExpectedRequests) {
		backend.tb.Errorf("Unexpected backend request: %s %s: %s", r.Method, r.URL, unsealedForm)
		return
	}

	cur := backend.ExpectedRequests[backend.currentRequest]
	backend.currentRequest++

	headers := w.Header()
	for k, v := range cur.ResponseHeaders {
		if len(v) == 1 {
			headers.Set(k, v[0])
		} else if len(v) == 0 {
			headers.Del(k)
		} else {
			for _, hv := range v { headers.Add(k, hv) }
		}
	}

	defer func() {
		w.WriteHeader(cur.ResponseCode)
		if cur.Response != "" {
			w.Write([]byte(cur.Response))
		}
	}()

	if cur.Path != "" {
		if r.URL.Path != cur.Path {
			backend.tb.Errorf("Bad backend request. Expected %v, got %s %s", cur, r.Method, r.URL)
			return
		}
	}

	if cur.PostForm != nil {
		anyErr := TcompareForms(backend.tb, "Different form contents", *cur.PostForm, unsealedForm)
		if anyErr {
			backend.tb.Errorf("...in %s %s: %s", r.Method, r.URL, unsealedForm.Encode())
		}
	}
}

func (backend *TBackendRequestChecker) Close() error {
	if backend.currentRequest < len(backend.ExpectedRequests) {
		backend.tb.Errorf("Not all requests sent, got %d out of %d", backend.currentRequest, len(backend.ExpectedRequests))
	}
	return nil
}

func TcompareForms(tb TBC, ctx string, expectedForm, gotForm url.Values) (anyErrors bool) {
	for k, expVal := range expectedForm {
		gotVal, ok := gotForm[k]
		if !ok {
			tb.Errorf("%s: Form[%s]: Expected %v, (got nothing)", ctx, k, expVal)
			anyErrors = true
			continue
		}
		if len(expVal) != len(gotVal) {
			tb.Errorf("%s: Form[%s]: Expected %d%v, Got %d%v", ctx, k, len(expVal), expVal, len(gotVal), gotVal)
			anyErrors = true
			continue
		}
		for i, el := range expVal {
			if gotVal[i] != el {
				tb.Errorf("%s: Form[%s][%d]: Expected %s, Got %s", ctx, k, i, el, gotVal[i])
				anyErrors = true
			}
		}
	}
	for k, gotVal := range gotForm {
		_, ok := expectedForm[k]
		if !ok {
			tb.Errorf("%s: Form[%s]: (expected nothing), Got %v", ctx, k, gotVal)
			anyErrors = true
		}
	}
	return anyErrors
}

func TCountOpenFDs() uint64 {
	ary, _ := ioutil.ReadDir(fmt.Sprintf("/proc/%d/fd", os.Getpid()))
	return uint64(len(ary))
}

const IgnoreReceivedArguments = 1 + 2i

func TReceiveExpectedMessage(tb testing.TB, conn *websocket.Conn, messageID int, command Command, arguments interface{}) (ClientMessage, bool) {
	var msg ClientMessage
	var fail bool
	messageType, packet, err := conn.ReadMessage()
	if err != nil {
		tb.Error(err)
		return msg, false
	}
	if messageType != websocket.TextMessage {
		tb.Error("got non-text message", packet)
		return msg, false
	}

	err = UnmarshalClientMessage(packet, messageType, &msg)
	if err != nil {
		tb.Error(err)
		return msg, false
	}
	if msg.MessageID != messageID {
		tb.Error("Message ID was wrong. Expected", messageID, ", got", msg.MessageID, ":", msg)
		fail = true
	}
	if msg.Command != command {
		tb.Error("Command was wrong. Expected", command, ", got", msg.Command, ":", msg)
		fail = true
	}
	if arguments != IgnoreReceivedArguments {
		if arguments == nil {
			if msg.origArguments != "" {
				tb.Error("Arguments are wrong. Expected", arguments, ", got", msg.Arguments, ":", msg)
			}
		} else {
			argBytes, _ := json.Marshal(arguments)
			if msg.origArguments != string(argBytes) {
				tb.Error("Arguments are wrong. Expected", arguments, ", got", msg.Arguments, ":", msg)
			}
		}
	}
	return msg, !fail
}

func TSendMessage(tb testing.TB, conn *websocket.Conn, messageID int, command Command, arguments interface{}) bool {
	SendMessage(conn, ClientMessage{MessageID: messageID, Command: command, Arguments: arguments})
	return true
}

func TSealForSavePubMsg(tb testing.TB, cmd Command, channel string, arguments interface{}, deleteMode bool) (url.Values, error) {
	form := url.Values{}
	form.Set("cmd", string(cmd))
	argsBytes, err := json.Marshal(arguments)
	if err != nil {
		tb.Error(err)
		return nil, err
	}
	form.Set("args", string(argsBytes))
	form.Set("channel", channel)
	if deleteMode {
		form.Set("delete", "1")
	}
	form.Set("time", time.Now().Format(time.UnixDate))

	sealed, err := SealRequest(form)
	if err != nil {
		tb.Error(err)
		return nil, err
	}
	return sealed, nil
}

func TSealForUncachedPubMsg(tb testing.TB, cmd Command, channel string, arguments interface{}, scope MessageTargetType, deleteMode bool) (url.Values, error) {
	form := url.Values{}
	form.Set("cmd", string(cmd))
	argsBytes, err := json.Marshal(arguments)
	if err != nil {
		tb.Error(err)
		return nil, err
	}
	form.Set("args", string(argsBytes))
	form.Set("channel", channel)
	if deleteMode {
		form.Set("delete", "1")
	}
	form.Set("time", time.Now().Format(time.UnixDate))
	form.Set("scope", scope.String())

	sealed, err := SealRequest(form)
	if err != nil {
		tb.Error(err)
		return nil, err
	}
	return sealed, nil
}

func TCheckResponse(tb testing.TB, resp *http.Response, expected string, desc string) bool {
	var failed bool
	respBytes, err := ioutil.ReadAll(resp.Body)
	resp.Body.Close()
	respStr := string(respBytes)

	if err != nil {
		tb.Error(err)
		failed = true
	}

	if resp.StatusCode != 200 {
		tb.Error("Publish failed: ", resp.StatusCode, respStr)
		failed = true
	}

	if respStr != expected {
		tb.Errorf("Got wrong response from server. %s Expected: '%s' Got: '%s'", desc, expected, respStr)
		failed = true
	}
	return !failed
}

type TURLs struct {
	Websocket      string
	Origin         string
	UncachedPubMsg string // uncached_pub
	SavePubMsg     string // cached_pub
}

func TGetUrls(socketserver *httptest.Server, backend *httptest.Server) TURLs {
	addr := socketserver.Listener.Addr().String()
	return TURLs{
		Websocket:      fmt.Sprintf("ws://%s/", addr),
		Origin:         fmt.Sprintf("http://%s", addr),
		UncachedPubMsg: fmt.Sprintf("http://%s/uncached_pub", addr),
		SavePubMsg:     fmt.Sprintf("http://%s/cached_pub", addr),
	}
}
