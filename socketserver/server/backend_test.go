package server

import (
	. "gopkg.in/check.v1"
	"net/http"
	"net/url"
	"testing"
)

func Test(t *testing.T) { TestingT(t) }

func TestSealRequest(t *testing.T) {
	TSetup(SetupNoServers, nil)

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

type BackendSuite struct{}

var _ = Suite(&BackendSuite{})

func (s *BackendSuite) TestSendRemoteCommand(c *C) {
	const TestCommand1 = "somecommand"
	const TestCommand2 = "other"
	const PathTestCommand1 = "/cmd/" + TestCommand1
	const PathTestCommand2 = "/cmd/" + TestCommand2
	const TestData1 = "623478.32"
	const TestData2 = "\"Hello, there\""
	const TestData3 = "3"
	const TestUsername = "sirstendec"
	const TestResponse1 = "asfdg"
	const TestResponse2 = "yuiop"
	const TestErrorText = "{\"err\":\"some kind of special error\"}"

	var AnonAuthInfo = AuthInfo{}
	var NonValidatedAuthInfo = AuthInfo{TwitchUsername: TestUsername}
	var ValidatedAuthInfo = AuthInfo{TwitchUsername: TestUsername, UsernameValidated: true}

	headersCacheTwoSeconds := http.Header{"FFZ-Cache": []string{"2"}}
	headersCacheInvalid := http.Header{"FFZ-Cache": []string{"NotANumber"}}
	headersApplicationJson := http.Header{"Content-Type": []string{"application/json"}}

	backend := NewTBackendRequestChecker(c,
		TExpectedBackendRequest{200, PathTestCommand1, &url.Values{"clientData": []string{TestData1}, "authenticated": []string{"0"}, "username": []string{""}}, TestResponse1, nil},
		TExpectedBackendRequest{200, PathTestCommand1, &url.Values{"clientData": []string{TestData1}, "authenticated": []string{"0"}, "username": []string{""}}, TestResponse2, nil},
		TExpectedBackendRequest{200, PathTestCommand1, &url.Values{"clientData": []string{TestData1}, "authenticated": []string{"0"}, "username": []string{TestUsername}}, TestResponse1, nil},
		TExpectedBackendRequest{200, PathTestCommand1, &url.Values{"clientData": []string{TestData1}, "authenticated": []string{"1"}, "username": []string{TestUsername}}, TestResponse1, nil},
		TExpectedBackendRequest{200, PathTestCommand2, &url.Values{"clientData": []string{TestData2}, "authenticated": []string{"0"}, "username": []string{TestUsername}}, TestResponse1, headersCacheTwoSeconds},
		// cached
		// cached
		TExpectedBackendRequest{200, PathTestCommand2, &url.Values{"clientData": []string{TestData1}, "authenticated": []string{"0"}, "username": []string{TestUsername}}, TestResponse2, headersCacheTwoSeconds},
		TExpectedBackendRequest{401, PathTestCommand1, &url.Values{"clientData": []string{TestData1}, "authenticated": []string{"0"}, "username": []string{TestUsername}}, "", nil},
		TExpectedBackendRequest{503, PathTestCommand1, &url.Values{"clientData": []string{TestData1}, "authenticated": []string{"0"}, "username": []string{TestUsername}}, "", nil},
		TExpectedBackendRequest{418, PathTestCommand1, &url.Values{"clientData": []string{TestData1}, "authenticated": []string{"0"}, "username": []string{TestUsername}}, TestErrorText, headersApplicationJson},
		TExpectedBackendRequest{200, PathTestCommand2, &url.Values{"clientData": []string{TestData3}, "authenticated": []string{"0"}, "username": []string{TestUsername}}, TestResponse1, headersCacheInvalid},
	)
	_, _, _ = TSetup(SetupWantBackendServer, backend)
	defer backend.Close()

	var resp string
	var err error

	resp, err = SendRemoteCommand(TestCommand1, TestData1, AnonAuthInfo)
	c.Check(resp, Equals, TestResponse1)
	c.Check(err, IsNil)

	resp, err = SendRemoteCommand(TestCommand1, TestData1, AnonAuthInfo)
	c.Check(resp, Equals, TestResponse2)
	c.Check(err, IsNil)

	resp, err = SendRemoteCommand(TestCommand1, TestData1, NonValidatedAuthInfo)
	c.Check(resp, Equals, TestResponse1)
	c.Check(err, IsNil)

	resp, err = SendRemoteCommand(TestCommand1, TestData1, ValidatedAuthInfo)
	c.Check(resp, Equals, TestResponse1)
	c.Check(err, IsNil)
	// cache save
	resp, err = SendRemoteCommandCached(TestCommand2, TestData2, NonValidatedAuthInfo)
	c.Check(resp, Equals, TestResponse1)
	c.Check(err, IsNil)

	resp, err = SendRemoteCommandCached(TestCommand2, TestData2, NonValidatedAuthInfo) // cache hit
	c.Check(resp, Equals, TestResponse1)
	c.Check(err, IsNil)

	resp, err = SendRemoteCommandCached(TestCommand2, TestData2, AnonAuthInfo) // cache hit
	c.Check(resp, Equals, TestResponse1)
	c.Check(err, IsNil)
	// cache miss - data is different
	resp, err = SendRemoteCommandCached(TestCommand2, TestData1, NonValidatedAuthInfo)
	c.Check(resp, Equals, TestResponse2)
	c.Check(err, IsNil)

	resp, err = SendRemoteCommand(TestCommand1, TestData1, NonValidatedAuthInfo)
	c.Check(resp, Equals, "")
	c.Check(err, Equals, ErrAuthorizationNeeded)

	resp, err = SendRemoteCommand(TestCommand1, TestData1, NonValidatedAuthInfo)
	c.Check(resp, Equals, "")
	c.Check(err, ErrorMatches, "backend http error: 503")

	resp, err = SendRemoteCommand(TestCommand1, TestData1, NonValidatedAuthInfo)
	c.Check(resp, Equals, "")
	c.Check(err, ErrorMatches, TestErrorText)

	resp, err = SendRemoteCommand(TestCommand2, TestData3, NonValidatedAuthInfo)
	c.Check(resp, Equals, "")
	c.Check(err, ErrorMatches, "The RPC server returned a non-integer cache duration: .*")
}
