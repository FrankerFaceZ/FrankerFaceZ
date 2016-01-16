package server

import (
	"github.com/satori/go.uuid"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"
)

func TestUniqueConnections(t *testing.T) {
	const TestExpectedCount = 1000

	testStart := time.Now().In(counterLocation)

	var server *httptest.Server
	var backendExpected = NewTBackendRequestChecker(t,
		TExpectedBackendRequest{200, bPathAnnounceStartup, &url.Values{"startup": []string{"1"}}, "", nil},
	)
	server, _, _ = TSetup(SetupWantSocketServer|SetupWantBackendServer, backendExpected)

	defer server.CloseClientConnections()
	defer unsubscribeAllClients()
	defer backendExpected.Close()

	dumpUniqueUsers()

	for i := 0; i < TestExpectedCount; i++ {
		uuid := uuid.NewV4()
		uniqueUserChannel <- uuid
		uniqueUserChannel <- uuid
	}

	TCheckHLLValue(t, TestExpectedCount, readCurrentHLL())

	token := <-uniqueCtrWritingToken
	uniqueCounter.End = time.Now().In(counterLocation).Add(-1 * time.Second)
	uniqueCtrWritingToken <- token

	rolloverCounters_do()

	for i := 0; i < TestExpectedCount; i++ {
		uuid := uuid.NewV4()
		uniqueUserChannel <- uuid
		uniqueUserChannel <- uuid
	}

	TCheckHLLValue(t, TestExpectedCount, readCurrentHLL())

	// Check: Merging the two days results in 2000
	// note: rolloverCounters_do() wrote out a file, and loadHLL() is reading it back
	// TODO need to rewrite some of the test to make this work
	var loadDest PeriodUniqueUsers
	loadHLL(testStart, &loadDest)

	token = <-uniqueCtrWritingToken
	loadDest.Counter.Merge(uniqueCounter.Counter)
	uniqueCtrWritingToken <- token

	TCheckHLLValue(t, TestExpectedCount*2, loadDest.Counter.Count())
}

func TestUniqueUsersCleanup(t *testing.T) {
	// Not a test. Removes old files.
	os.RemoveAll(uniqCountDir)
}
