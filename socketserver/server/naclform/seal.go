package naclform

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

var ErrorShortNonce = errors.New("Nonce too short.")
var ErrorInvalidSignature = errors.New("Invalid signature or contents")

type ServerInfo struct {
	SharedKey [32]byte
	ServerID  int
}

func fillCryptoRandom(buf []byte) error {
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

func (i *ServerInfo) Seal(form url.Values) (url.Values, error) {
	var nonce [24]byte
	var err error

	err = fillCryptoRandom(nonce[:])
	if err != nil {
		return nil, err
	}

	cipherMsg := box.SealAfterPrecomputation(nil, []byte(form.Encode()), &nonce, &i.SharedKey)

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
		"id":    []string{strconv.Itoa(i.ServerID)},
	}

	return retval, nil
}

func (i *ServerInfo) Unseal(form url.Values) (url.Values, error) {
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

	message, ok := box.OpenAfterPrecomputation(nil, cipherBuffer.Bytes(), &nonce, &i.SharedKey)
	if !ok {
		return nil, ErrorInvalidSignature
	}

	retValues, err := url.ParseQuery(string(message))
	if err != nil {
		return nil, ErrorInvalidSignature
	}

	return retValues, nil
}
