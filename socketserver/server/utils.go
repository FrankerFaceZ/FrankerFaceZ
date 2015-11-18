package server

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"golang.org/x/crypto/nacl/box"
	"log"
	"net/url"
	"strconv"
	"strings"
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

func New4KByteBuffer() interface{} {
	return make([]byte, 0, 4096)
}

func SealRequest(form url.Values) (url.Values, error) {
	var nonce [24]byte
	var err error

	err = FillCryptoRandom(nonce[:])
	if err != nil {
		return nil, err
	}

	cipherMsg := box.SealAfterPrecomputation(nil, []byte(form.Encode()), &nonce, &backendSharedKey)

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
		"id":    []string{strconv.Itoa(serverID)},
	}

	return retval, nil
}

var ErrorShortNonce = errors.New("Nonce too short.")
var ErrorInvalidSignature = errors.New("Invalid signature or contents")

func UnsealRequest(form url.Values) (url.Values, error) {
	var nonce [24]byte

	nonceString := form.Get("nonce")
	dec := base64.NewDecoder(base64.URLEncoding, strings.NewReader(nonceString))
	count, err := dec.Read(nonce[:])
	if err != nil {
		return nil, err
	}
	if count != 24 {
		return nil, ErrorShortNonce
	}

	cipherString := form.Get("msg")
	dec = base64.NewDecoder(base64.URLEncoding, strings.NewReader(cipherString))
	cipherBuffer := new(bytes.Buffer)
	cipherBuffer.ReadFrom(dec)

	message, ok := box.OpenAfterPrecomputation(nil, cipherBuffer.Bytes(), &nonce, &backendSharedKey)
	if !ok {
		return nil, ErrorInvalidSignature
	}

	retValues, err := url.ParseQuery(string(message))
	if err != nil {
		// Assume that the signature was accidentally correct but the contents were garbage
		log.Println("Error unsealing request:", err)
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

func AddToSliceC(ary *[]chan<- ClientMessage, val chan<- ClientMessage) bool {
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

func RemoveFromSliceC(ary *[]chan<- ClientMessage, val chan<- ClientMessage) bool {
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

func AddToSliceB(ary *[]bunchSubscriber, client *ClientInfo, mid int) bool {
	newSub := bunchSubscriber{Client: client, MessageID: mid}
	slice := *ary
	for _, v := range slice {
		if v == newSub {
			return false
		}
	}

	slice = append(slice, newSub)
	*ary = slice
	return true
}
