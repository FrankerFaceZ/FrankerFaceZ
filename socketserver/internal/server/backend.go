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
	"os"
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

func SetupBackend(config *Config) {
	backendHttpClient.Timeout = 60 * time.Second
	backendUrl = config.BackendUrl
	if responseCache != nil {
		responseCache.Flush()
	}
	responseCache = cache.New(60*time.Second, 120*time.Second)

	getBacklogUrl = fmt.Sprintf("%s/backlog", backendUrl)

	messageBufferPool.New = New4KByteBuffer

	var keys CryptoKeysBuf
	file, err := os.Open(config.NaclKeysFile)
	if err != nil {
		log.Fatal(err)
	}
	dec := json.NewDecoder(file)
	err = dec.Decode(&keys)
	if err != nil {
		log.Fatal(err)
	}

	var theirPublic, ourPrivate [32]byte
	copy(theirPublic[:], keys.TheirPublicKey)
	copy(ourPrivate[:], keys.OurPrivateKey)
	serverId = keys.ServerId

	box.Precompute(&backendSharedKey, &theirPublic, &ourPrivate)
}

func getCacheKey(remoteCommand, data string) string {
	return fmt.Sprintf("%s/%s", remoteCommand, data)
}

func HBackendPublishRequest(w http.ResponseWriter, r *http.Request) {
	formData, err := UnsealRequest(r.Form)
	if err != nil {
		w.WriteHeader(403)
		fmt.Fprintf(w, "Error: %v", err)
		return
	}

	cmd := formData.Get("cmd")
	json := formData.Get("args")
	chat := formData.Get("chat")
	watchChannel := formData.Get("channel")
	cm := ClientMessage{MessageID: -1, Command: Command(cmd), origArguments: json}
	var count int
	if chat != "" {
		count = PublishToChat(chat, cm)
	} else if watchChannel != "" {
		count = PublishToWatchers(watchChannel, cm)
	} else {
		w.WriteHeader(400)
		fmt.Fprint(w, "Need to specify either chat or channel")
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

func FetchBacklogData(chatSubs, channelSubs []string) ([]ClientMessage, error) {
	formData := url.Values{
		"chatSubs":    chatSubs,
		"channelSubs": channelSubs,
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
	output := CryptoKeysBuf{}

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
		output.TheirPublicKey = theirPublic
	}

	file, err := os.Create(outputFile)
	if err != nil {
		log.Fatal(err)
	}
	enc := json.NewEncoder(file)
	err = enc.Encode(output)
	if err != nil {
		log.Fatal(err)
	}
	err = file.Close()
	if err != nil {
		log.Fatal(err)
	}
}
