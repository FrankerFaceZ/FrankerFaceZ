package server

import (
	"net/http"
	"time"
	"fmt"
	"net/url"
	"github.com/pmylund/go-cache"
	"strconv"
	"io/ioutil"
)

var httpClient http.Client
var backendUrl string
var responseCache *cache.Cache

func SetupBackend(url string) {
	httpClient.Timeout = 60 * time.Second
	backendUrl = url
	responseCache = cache.New(60 * time.Second, 120 * time.Second)
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
	destUrl := fmt.Sprintf("%s/%s", backendUrl, remoteCommand)
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

	resp, err := httpClient.PostForm(destUrl, 	formData)
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