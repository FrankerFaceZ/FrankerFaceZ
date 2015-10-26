package server

import (
	"fmt"
	"golang.org/x/net/websocket"
	"testing"
)

func ExampleUnmarshalClientMessage() {
	sourceData := []byte("100 hello [\"ffz_3.5.30\",\"898b5bfa-b577-47bb-afb4-252c703b67d6\"]")
	var cm ClientMessage
	err := UnmarshalClientMessage(sourceData, websocket.TextFrame, &cm)
	fmt.Println(err)
	fmt.Println(cm.MessageID)
	fmt.Println(cm.Command)
	fmt.Println(cm.Arguments)
	// Output:
	// <nil>
	// 100
	// hello
	// [ffz_3.5.30 898b5bfa-b577-47bb-afb4-252c703b67d6]
}

func ExampleMarshalClientMessage() {
	var cm ClientMessage = ClientMessage{
		MessageID: -1,
		Command:   "do_authorize",
		Arguments: "1234567890",
	}
	data, payloadType, err := MarshalClientMessage(&cm)
	fmt.Println(err)
	fmt.Println(payloadType == websocket.TextFrame)
	fmt.Println(string(data))
	// Output:
	// <nil>
	// true
	// -1 do_authorize "1234567890"
}

func TestArgumentsAsStringAndBool(t *testing.T) {
	sourceData := []byte("1 foo [\"string\", false]")
	var cm ClientMessage
	err := UnmarshalClientMessage(sourceData, websocket.TextFrame, &cm)
	if err != nil {
		t.Fatal(err)
	}
	str, boolean, err := cm.ArgumentsAsStringAndBool()
	if err != nil {
		t.Fatal(err)
	}
	if str != "string" {
		t.Error("Expected first array item to be 'string', got", str)
	}
	if boolean != false {
		t.Error("Expected second array item to be false, got", boolean)
	}
}
