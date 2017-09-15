package server

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/url"
	"strconv"
	"strings"

	"golang.org/x/crypto/nacl/box"
)

func FillCryptoRandom(buf []byte) error {
	remaining := len(buf)
	for remaining > 0 {
		count, err := rand.Read(buf)
		if err != nil {
			return err
		}
		remaining -= count
	}
	return nil
}

func copyString(s string) string {
	return string([]byte(s))
}

func (backend *backendInfo) SealRequest(form url.Values) (url.Values, error) {
	var nonce [24]byte
	var err error

	err = FillCryptoRandom(nonce[:])
	if err != nil {
		return nil, err
	}

	cipherMsg := box.SealAfterPrecomputation(nil, []byte(form.Encode()), &nonce, &backend.sharedKey)

	bufMessage := new(bytes.Buffer)
	enc := base64.NewEncoder(base64.URLEncoding, bufMessage)
	enc.Write(cipherMsg)
	enc.Close()
	cipherString := bufMessage.String()

	bufNonce := new(bytes.Buffer)
	enc = base64.NewEncoder(base64.URLEncoding, bufNonce)
	enc.Write(nonce[:])
	enc.Close()
	nonceString := bufNonce.String()

	retval := url.Values{
		"nonce": []string{nonceString},
		"msg":   []string{cipherString},
		"id":    []string{strconv.Itoa(Backend.serverID)},
	}

	return retval, nil
}

var ErrorShortNonce = errors.New("Nonce too short.")
var ErrorInvalidSignature = errors.New("Invalid signature or contents")

func (backend *backendInfo) UnsealRequest(form url.Values) (url.Values, error) {
	var nonce [24]byte

	nonceString := form.Get("nonce")
	dec := base64.NewDecoder(base64.URLEncoding, strings.NewReader(nonceString))
	count, err := dec.Read(nonce[:])
	if err != nil {
		Statistics.BackendVerifyFails++
		return nil, err
	}
	if count != 24 {
		Statistics.BackendVerifyFails++
		return nil, ErrorShortNonce
	}

	cipherString := form.Get("msg")
	dec = base64.NewDecoder(base64.URLEncoding, strings.NewReader(cipherString))
	cipherBuffer := new(bytes.Buffer)
	cipherBuffer.ReadFrom(dec)

	message, ok := box.OpenAfterPrecomputation(nil, cipherBuffer.Bytes(), &nonce, &backend.sharedKey)
	if !ok {
		Statistics.BackendVerifyFails++
		return nil, ErrorInvalidSignature
	}

	retValues, err := url.ParseQuery(string(message))
	if err != nil {
		Statistics.BackendVerifyFails++
		return nil, ErrorInvalidSignature
	}

	return retValues, nil
}

func AddToSliceS(ary *[]string, val string) bool {
	slice := *ary
	for _, v := range slice {
		if v == val {
			return false
		}
	}

	slice = append(slice, val)
	*ary = slice
	return true
}

func RemoveFromSliceS(ary *[]string, val string) bool {
	slice := *ary
	var idx int = -1
	for i, v := range slice {
		if v == val {
			idx = i
			break
		}
	}
	if idx == -1 {
		return false
	}

	slice[idx] = slice[len(slice)-1]
	slice = slice[:len(slice)-1]
	*ary = slice
	return true
}

func AddToSliceCl(ary *[]*ClientInfo, val *ClientInfo) bool {
	slice := *ary
	for _, v := range slice {
		if v == val {
			return false
		}
	}

	slice = append(slice, val)
	*ary = slice
	return true
}

func RemoveFromSliceCl(ary *[]*ClientInfo, val *ClientInfo) bool {
	slice := *ary
	var idx int = -1
	for i, v := range slice {
		if v == val {
			idx = i
			break
		}
	}
	if idx == -1 {
		return false
	}

	slice[idx] = slice[len(slice)-1]
	slice = slice[:len(slice)-1]
	*ary = slice
	return true
}
