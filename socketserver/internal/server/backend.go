package server

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
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

var backendHttpClient http.Client
var backendUrl string
var responseCache *cache.Cache

var getBacklogUrl string

var backendSharedKey [32]byte
var serverId int

var messageBufferPool sync.Pool

func SetupBackend(config *ConfigFile) {
	backendHttpClient.Timeout = 60 * time.Second
	backendUrl = config.BackendUrl
	if responseCache != nil {
		responseCache.Flush()
	}
	responseCache = cache.New(60*time.Second, 120*time.Second)

	getBacklogUrl = fmt.Sprintf("%s/backlog", backendUrl)

	messageBufferPool.New = New4KByteBuffer

	var theirPublic, ourPrivate [32]byte
	copy(theirPublic[:], config.BackendPublicKey)
	copy(ourPrivate[:], config.OurPrivateKey)
	serverId = config.ServerId

	box.Precompute(&backendSharedKey, &theirPublic, &ourPrivate)
}

func getCacheKey(remoteCommand, data string) string {
	return fmt.Sprintf("%s/%s", remoteCommand, data)
}

// Publish a message to clients with no caching.
// The scope must be specified because no attempt is made to recognize the command.
func HBackendPublishRequest(w http.ResponseWriter, r *http.Request) {
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
		count = PublishToChat(channel, cm)
	case MsgTargetTypeMultichat:
		// TODO
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

func RequestRemoteDataCached(remoteCommand, data string, auth AuthInfo) (string, error) {
	cached, ok := responseCache.Get(getCacheKey(remoteCommand, data))
	if ok {
		return cached.(string), nil
	}
	return RequestRemoteData(remoteCommand, data, auth)
}

func RequestRemoteData(remoteCommand, data string, auth AuthInfo) (responseStr string, err error) {
	destUrl := fmt.Sprintf("%s/cmd/%s", backendUrl, remoteCommand)
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

	resp, err := backendHttpClient.PostForm(destUrl, sealedForm)
	if err != nil {
		return "", err
	}

	respBytes, err := ioutil.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return "", err
	}

	responseStr = string(respBytes)

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

func FetchBacklogData(chatSubs []string) ([]ClientMessage, error) {
	formData := url.Values{
		"subs": chatSubs,
	}

	sealedForm, err := SealRequest(formData)
	if err != nil {
		return nil, err
	}

	resp, err := backendHttpClient.PostForm(getBacklogUrl, sealedForm)
	if err != nil {
		return nil, err
	}
	dec := json.NewDecoder(resp.Body)
	var messages []ClientMessage
	err = dec.Decode(messages)
	if err != nil {
		return nil, err
	}

	return messages, nil
}

func GenerateKeys(outputFile, serverId, theirPublicStr string) {
	var err error
	output := ConfigFile{
		ListenAddr: "0.0.0.0:8001",
		SocketOrigin: "localhost:8001",
		BackendUrl: "http://localhost:8002/ffz",
		BannerHTML: `
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
</div>
`,
	}

	output.ServerId, err = strconv.Atoi(serverId)
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
