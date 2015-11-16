package server

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/pmylund/go-cache"
	"golang.org/x/crypto/nacl/box"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

var backendHTTPClient http.Client
var backendURL string
var responseCache *cache.Cache

var getBacklogURL string
var postStatisticsURL string
var addTopicURL string
var announceStartupURL string

var backendSharedKey [32]byte
var serverID int

var messageBufferPool sync.Pool

func setupBackend(config *ConfigFile) {
	backendHTTPClient.Timeout = 60 * time.Second
	backendURL = config.BackendURL
	if responseCache != nil {
		responseCache.Flush()
	}
	responseCache = cache.New(60*time.Second, 120*time.Second)

	getBacklogURL = fmt.Sprintf("%s/backlog", backendURL)
	postStatisticsURL = fmt.Sprintf("%s/stats", backendURL)
	addTopicURL = fmt.Sprintf("%s/topics", backendURL)
	announceStartupURL = fmt.Sprintf("%s/startup", backendURL)

	messageBufferPool.New = New4KByteBuffer

	var theirPublic, ourPrivate [32]byte
	copy(theirPublic[:], config.BackendPublicKey)
	copy(ourPrivate[:], config.OurPrivateKey)
	serverID = config.ServerID

	box.Precompute(&backendSharedKey, &theirPublic, &ourPrivate)
}

func getCacheKey(remoteCommand, data string) string {
	return fmt.Sprintf("%s/%s", remoteCommand, data)
}

// HBackendPublishRequest handles the /uncached_pub route.
// The backend can POST here to publish a message to clients with no caching.
// The POST arguments are `cmd`, `args`, `channel`, and `scope`.
// The `scope` argument is required because no attempt is made to infer the scope from the command, unlike /cached_pub.
func HTTPBackendUncachedPublish(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	formData, err := UnsealRequest(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

	cmd := formData.Get("cmd")
	json := formData.Get("args")
	channel := formData.Get("channel")
	scope := formData.Get("scope")

	target := MessageTargetTypeByName(scope)

	if cmd == "" {
		w.WriteHeader(422)
		fmt.Fprintf(w, "Error: cmd cannot be blank")
		return
	}
	if channel == "" && (target == MsgTargetTypeChat || target == MsgTargetTypeMultichat) {
		w.WriteHeader(422)
		fmt.Fprintf(w, "Error: channel must be specified")
		return
	}

	cm := ClientMessage{MessageID: -1, Command: Command(cmd), origArguments: json}
	cm.parseOrigArguments()
	var count int

	switch target {
	case MsgTargetTypeSingle:
	// TODO
	case MsgTargetTypeChat:
		count = PublishToChannel(channel, cm)
	case MsgTargetTypeMultichat:
		count = PublishToMultiple(strings.Split(channel, ","), cm)
	case MsgTargetTypeGlobal:
		count = PublishToAll(cm)
	case MsgTargetTypeInvalid:
	default:
		w.WriteHeader(422)
		fmt.Fprint(w, "Invalid 'scope'. must be single, chat, multichat, channel, or global")
		return
	}
	fmt.Fprint(w, count)
}

// ErrForwardedFromBackend is an error returned by the backend server.
type ErrForwardedFromBackend string

func (bfe ErrForwardedFromBackend) Error() string {
	return string(bfe)
}

// ErrAuthorizationNeeded is emitted when the backend replies with HTTP 401.
// Indicates that an attempt to validate `ClientInfo.TwitchUsername` should be attempted.
var ErrAuthorizationNeeded = errors.New("Must authenticate Twitch username to use this command")

// SendRemoteCommandCached performs a RPC call on the backend, but caches responses.
func SendRemoteCommandCached(remoteCommand, data string, auth AuthInfo) (string, error) {
	cached, ok := responseCache.Get(getCacheKey(remoteCommand, data))
	if ok {
		return cached.(string), nil
	}
	return SendRemoteCommand(remoteCommand, data, auth)
}

// SendRemoteCommand performs a RPC call on the backend by POSTing to `/cmd/$remoteCommand`.
// The form data is as follows: `clientData` is the JSON in the `data` parameter
// (should be retrieved from ClientMessage.Arguments), and either `username` or
// `usernameClaimed` depending on whether AuthInfo.UsernameValidates is true is AuthInfo.TwitchUsername.
func SendRemoteCommand(remoteCommand, data string, auth AuthInfo) (responseStr string, err error) {
	destURL := fmt.Sprintf("%s/cmd/%s", backendURL, remoteCommand)
	var authKey string
	if auth.UsernameValidated {
		authKey = "usernameClaimed"
	} else {
		authKey = "username"
	}

	formData := url.Values{
		"clientData": []string{data},
		authKey:      []string{auth.TwitchUsername},
	}

	sealedForm, err := SealRequest(formData)
	if err != nil {
		return "", err
	}

	resp, err := backendHTTPClient.PostForm(destURL, sealedForm)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	responseStr = string(respBytes)

	if resp.StatusCode == 401 {
		return "", ErrAuthorizationNeeded
	} else if resp.StatusCode != 200 {
		if resp.Header.Get("Content-Type") == "application/json" {
			return "", ErrForwardedFromBackend(responseStr)
		}
		return "", httpError(resp.StatusCode)
	}

	if resp.Header.Get("FFZ-Cache") != "" {
		durSecs, err := strconv.ParseInt(resp.Header.Get("FFZ-Cache"), 10, 64)
		if err != nil {
			return "", fmt.Errorf("The RPC server returned a non-integer cache duration: %v", err)
		}
		duration := time.Duration(durSecs) * time.Second
		responseCache.Set(getCacheKey(remoteCommand, data), responseStr, duration)
	}

	return
}

// SendAggregatedData sends aggregated emote usage and following data to the backend server.
func SendAggregatedData(sealedForm url.Values) error {
	resp, err := backendHTTPClient.PostForm(postStatisticsURL, sealedForm)
	if err != nil {
		return err
	}
	if resp.StatusCode != 200 {
		resp.Body.Close()
		return httpError(resp.StatusCode)
	}

	return resp.Body.Close()
}

// FetchBacklogData makes a request to the backend for backlog data on a set of pub/sub topics.
// TODO scrap this, replaced by /cached_pub
func FetchBacklogData(chatSubs []string) ([]ClientMessage, error) {
	formData := url.Values{
		"subs": chatSubs,
	}

	sealedForm, err := SealRequest(formData)
	if err != nil {
		return nil, err
	}

	resp, err := backendHTTPClient.PostForm(getBacklogURL, sealedForm)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, httpError(resp.StatusCode)
	}
	dec := json.NewDecoder(resp.Body)
	var messageStrings []string
	err = dec.Decode(messageStrings)
	if err != nil {
		return nil, err
	}

	var messages = make([]ClientMessage, len(messageStrings))
	for i, str := range messageStrings {
		UnmarshalClientMessage([]byte(str), websocket.TextMessage, &messages[i])
	}

	return messages, nil
}

// ErrBackendNotOK indicates that the backend replied with something other than the string "ok".
type ErrBackendNotOK struct {
	Response string
	Code     int
}

// Implements the error interface.
func (noe ErrBackendNotOK) Error() string {
	return fmt.Sprintf("backend returned %d: %s", noe.Code, noe.Response)
}

// SendNewTopicNotice notifies the backend that a client has performed the first subscription to a pub/sub topic.
// POST data:
// channels=room.trihex
// added=t
func SendNewTopicNotice(topic string) error {
	return sendTopicNotice(topic, true)
}

// SendCleanupTopicsNotice notifies the backend that pub/sub topics have no subscribers anymore.
// POST data:
// channels=room.sirstendec,room.bobross,feature.foo
// added=f
func SendCleanupTopicsNotice(topics []string) error {
	return sendTopicNotice(strings.Join(topics, ","), false)
}

func sendTopicNotice(topic string, added bool) error {
	formData := url.Values{}
	formData.Set("channels", topic)
	if added {
		formData.Set("added", "t")
	} else {
		formData.Set("added", "f")
	}

	sealedForm, err := SealRequest(formData)
	if err != nil {
		return err
	}

	resp, err := backendHTTPClient.PostForm(addTopicURL, sealedForm)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	respStr := string(respBytes)
	if respStr != "ok" {
		return ErrBackendNotOK{Code: resp.StatusCode, Response: respStr}
	}

	return nil
}

func httpError(statusCode int) error {
	return fmt.Errorf("backend http error: %d", statusCode)
}

// GenerateKeys generates a new NaCl keypair for the server and writes out the default configuration file.
func GenerateKeys(outputFile, serverID, theirPublicStr string) {
	var err error
	output := ConfigFile{
		ListenAddr:   "0.0.0.0:8001",
		SocketOrigin: "localhost:8001",
		BackendURL:   "http://localhost:8002/ffz",
	}

	output.ServerID, err = strconv.Atoi(serverID)
	if err != nil {
		log.Fatal(err)
	}

	ourPublic, ourPrivate, err := box.GenerateKey(rand.Reader)
	if err != nil {
		log.Fatal(err)
	}
	output.OurPublicKey, output.OurPrivateKey = ourPublic[:], ourPrivate[:]

	if theirPublicStr != "" {
		reader := base64.NewDecoder(base64.StdEncoding, strings.NewReader(theirPublicStr))
		theirPublic, err := ioutil.ReadAll(reader)
		if err != nil {
			log.Fatal(err)
		}
		output.BackendPublicKey = theirPublic
	}

	bytes, err := json.MarshalIndent(output, "", "\t")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(bytes))
	err = ioutil.WriteFile(outputFile, bytes, 0600)
	if err != nil {
		log.Fatal(err)
	}
}
