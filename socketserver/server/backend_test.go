package server

import (
	"crypto/rand"
	"fmt"
	"golang.org/x/crypto/nacl/box"
	"net/http"
	"net/url"
	"testing"
)

func SetupRandomKeys(t testing.TB) {
	_, senderPrivate, err := box.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	receiverPublic, _, err := box.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}

	box.Precompute(&backendSharedKey, receiverPublic, senderPrivate)
	messageBufferPool.New = New4KByteBuffer
}

func TestSealRequest(t *testing.T) {
	SetupRandomKeys(t)

	values := url.Values{
		"QuickBrownFox": []string{"LazyDog"},
	}

	sealedValues, err := SealRequest(values)
	if err != nil {
		t.Fatal(err)
	}
	// sealedValues.Encode()
	// id=0&msg=KKtbng49dOLLyjeuX5AnXiEe6P0uZwgeP_7mMB5vhP-wMAAPZw%3D%3D&nonce=-wRbUnifscisWUvhm3gBEXHN5QzrfzgV

	unsealedValues, err := UnsealRequest(sealedValues)
	if err != nil {
		t.Fatal(err)
	}

	if unsealedValues.Get("QuickBrownFox") != "LazyDog" {
		t.Errorf("Failed to round-trip, got back %v", unsealedValues)
	}
}

const MethodIsPost = "POST"

type ExpectedBackendRequest struct {
	ResponseCode int
	Path         string
	// Method       string // always POST
	PostForm *url.Values
	Response string
}

func (er *ExpectedBackendRequest) String() string {
	if MethodIsPost == "" {
		return er.Path
	}
	return fmt.Sprint("%s %s: %s", MethodIsPost, er.Path, er.PostForm.Encode())
}

type BackendRequestChecker struct {
	ExpectedRequests []ExpectedBackendRequest

	currentRequest int
	tb             testing.TB
}

func NewBackendRequestChecker(tb testing.TB, urls ...ExpectedBackendRequest) *BackendRequestChecker {
	return &BackendRequestChecker{ExpectedRequests: urls, tb: tb, currentRequest: 0}
}

func (backend *BackendRequestChecker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
		anyErr := compareForms(backend.tb, "Different form contents", *cur.PostForm, unsealedForm)
		if anyErr {
			backend.tb.Errorf("...in %s %s: %s", r.Method, r.URL, unsealedForm.Encode())
		}
	}
}

func (backend *BackendRequestChecker) Close() error {
	if backend.currentRequest < len(backend.ExpectedRequests) {
		backend.tb.Errorf("Not all requests sent, got %d out of %d", backend.currentRequest, len(backend.ExpectedRequests))
	}
	return nil
}

func compareForms(tb testing.TB, ctx string, expectedForm, gotForm url.Values) (anyErrors bool) {
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
