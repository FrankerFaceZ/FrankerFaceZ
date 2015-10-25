package lib

import (
	"golang.org/x/net/websocket"
	"fmt"
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
		Command: "do_authorize",
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
