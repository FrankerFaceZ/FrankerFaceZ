package server

import (
	"crypto/rand"
	"golang.org/x/crypto/nacl/box"
	"net/url"
	"testing"
)

func SetupRandomKeys(t testing.TB) {
	_, senderPrivate, err := box.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	receiverPublic, _, err := box.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}

	box.Precompute(&backendSharedKey, receiverPublic, senderPrivate)
	messageBufferPool.New = New4KByteBuffer
}

func TestSealRequest(t *testing.T) {
	SetupRandomKeys(t)

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
