package server
import (
	"testing"
	"net/url"
	"golang.org/x/crypto/nacl/box"
	"crypto/rand"
)

func TestSealRequest(t *testing.T) {
	senderPublic, senderPrivate, err := box.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	receiverPublic, receiverPrivate, err := box.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}

	messageBufferPool.New = New4KByteBuffer

	values := url.Values{
		"QuickBrownFox": []string{"LazyDog"},
	}

	box.Precompute(&backendSharedKey, receiverPublic, senderPrivate)
	sealedValues, err := SealRequest(values)
	if err != nil {
		t.Fatal(err)
	}

	box.Precompute(&backendSharedKey, senderPublic, receiverPrivate)
	unsealedValues, err := UnsealRequest(sealedValues)
	if err != nil {
		t.Fatal(err)
	}

	if unsealedValues.Get("QuickBrownFox") != "LazyDog" {
		t.Errorf("Failed to round-trip, got back %v", unsealedValues)
	}
}
