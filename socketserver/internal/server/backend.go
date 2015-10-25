package server

import (
	"net/http"
	"time"
	"fmt"
	"net/url"
	"github.com/pmylund/go-cache"
	"strconv"
	"io/ioutil"
	"encoding/json"
	"crypto/tls"
	"crypto/x509"
	"log"
)

var backendHttpClient http.Client
var backendUrl string
var responseCache *cache.Cache

var getBacklogUrl string

func SetupBackend(config *Config) {
	backendHttpClient.Timeout = 60 * time.Second
	backendUrl = config.BackendUrl
	if responseCache != nil {
		responseCache.Flush()
	}
	responseCache = cache.New(60 * time.Second, 120 * time.Second)

	getBacklogUrl = fmt.Sprintf("%s/backlog", backendUrl)
}

func SetupBackendCertificates(config *Config, certPool x509.CertPool) {
	myCert, err := tls.LoadX509KeyPair(config.BackendClientCertFile, config.BackendClientKeyFile)
	if err != nil {
		log.Fatal(err)
	}
	tlsConfig := tls.Config{
		Certificates: []tls.Certificate{myCert},
		RootCAs: certPool,
	}
	tlsConfig.BuildNameToCertificate()
	transport := &http.Transport{TLSClientConfig: tlsConfig}
	backendHttpClient.Transport = transport
}

func getCacheKey(remoteCommand, data string) string {
	return fmt.Sprintf("%s/%s", remoteCommand, data)
}

func RequestRemoteDataCached(remoteCommand, data string, auth AuthInfo) (string, error) {
	cached, ok := responseCache.Get(getCacheKey(remoteCommand, data))
	if ok {
		return cached.(string), nil
	}
	return RequestRemoteData(remoteCommand, data, auth)
}

func RequestRemoteData(remoteCommand, data string, auth AuthInfo) (string, error) {
	destUrl := fmt.Sprintf("%s/cmd/%s", backendUrl, remoteCommand)
	var authKey string
	if auth.UsernameValidated {
		authKey = "usernameClaimed"
	} else {
		authKey = "username"
	}

	formData := url.Values{
		"clientData": []string{data},
		authKey: []string{auth.TwitchUsername},
	}
	if gconfig.BasicAuthPassword != "" {
		formData["password"] = gconfig.BasicAuthPassword
	}

	resp, err := backendHttpClient.PostForm(destUrl, formData)
	if err != nil {
		return "", err
	}

	respBytes, err := ioutil.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return "", err
	}

	responseJson := string(respBytes)

	if resp.Header.Get("FFZ-Cache") != "" {
		durSecs, err := strconv.ParseInt(resp.Header.Get("FFZ-Cache"), 10, 64)
		if err != nil {
			return "", fmt.Errorf("The RPC server returned a non-integer cache duration: %v", err)
		}
		duration := time.Duration(durSecs) * time.Second
		responseCache.Set(getCacheKey(remoteCommand, data), responseJson, duration)
	}

	return responseJson, nil
}

func FetchBacklogData(chatSubs, channelSubs []string) ([]ClientMessage, error) {
	formData := url.Values{
		"chatSubs": chatSubs,
		"channelSubs": channelSubs,
	}

	resp, err := backendHttpClient.PostForm(getBacklogUrl, formData)
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