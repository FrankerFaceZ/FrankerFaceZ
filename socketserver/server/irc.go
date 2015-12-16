package server

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	irc "github.com/fluffle/goirc/client"
	"log"
	"strings"
	"sync"
	"time"
)

type AuthCallback func(client *ClientInfo, successful bool)

type PendingAuthorization struct {
	Client    *ClientInfo
	Challenge string
	Callback  AuthCallback
	EnteredAt time.Time
}

var PendingAuths []PendingAuthorization
var PendingAuthLock sync.Mutex

func AddPendingAuthorization(client *ClientInfo, challenge string, callback AuthCallback) {
	PendingAuthLock.Lock()
	defer PendingAuthLock.Unlock()

	PendingAuths = append(PendingAuths, PendingAuthorization{
		Client:    client,
		Challenge: challenge,
		Callback:  callback,
		EnteredAt: time.Now(),
	})
}

func authorizationJanitor() {
	for {
		time.Sleep(5 * time.Minute)
		authorizationJanitor_do()
	}
}

func authorizationJanitor_do() {
	cullTime := time.Now().Add(-30 * time.Minute)

	PendingAuthLock.Lock()
	defer PendingAuthLock.Unlock()

	newPendingAuths := make([]PendingAuthorization, 0, len(PendingAuths))

	for _, v := range PendingAuths {
		if !cullTime.After(v.EnteredAt) {
			newPendingAuths = append(newPendingAuths, v)
		} else {
			v.Callback(v.Client, false)
		}
	}

	PendingAuths = newPendingAuths
}

func (client *ClientInfo) StartAuthorization(callback AuthCallback) {
	var nonce [32]byte
	_, err := rand.Read(nonce[:])
	if err != nil {
		go func(client *ClientInfo, callback AuthCallback) {
			callback(client, false)
		}(client, callback)
		return
	}
	buf := bytes.NewBuffer(nil)
	enc := base64.NewEncoder(base64.RawURLEncoding, buf)
	enc.Write(nonce[:])
	enc.Close()
	challenge := buf.String()

	AddPendingAuthorization(client, challenge, callback)

	client.MessageChannel <- ClientMessage{MessageID: -1, Command: AuthorizeCommand, Arguments: challenge}
}

const AuthChannelName = "frankerfacezauthorizer"
const AuthChannel = "#" + AuthChannelName
const AuthCommand = "AUTH"

const DEBUG = "DEBUG"

var errChallengeNotFound = errors.New("did not find a challenge solved by that message")

func ircConnection() {

	c := irc.SimpleClient("justinfan123")

	c.HandleFunc(irc.CONNECTED, func(conn *irc.Conn, line *irc.Line) {
		conn.Join(AuthChannel)
	})

	c.HandleFunc(irc.PRIVMSG, func(conn *irc.Conn, line *irc.Line) {
		channel := line.Args[0]
		msg := line.Args[1]
		if channel != AuthChannel || !strings.HasPrefix(msg, AuthCommand) || !line.Public() {
			return
		}

		msgArray := strings.Split(msg, " ")
		if len(msgArray) != 2 {
			return
		}

		submittedUser := line.Nick
		submittedChallenge := msgArray[1]

		submitAuth(submittedUser, submittedChallenge)
	})

	err := c.ConnectTo("irc.twitch.tv")
	if err != nil {
		log.Fatalln("Cannot connect to IRC:", err)
	}

}

func submitAuth(user, challenge string) {
	var auth PendingAuthorization
	var idx int = -1

	PendingAuthLock.Lock()
	for i, v := range PendingAuths {
		if v.Client.TwitchUsername == user && v.Challenge == challenge {
			auth = v
			idx = i
			break
		}
	}
	if idx != -1 {
		PendingAuths = append(PendingAuths[:idx], PendingAuths[idx+1:]...)
	}
	PendingAuthLock.Unlock()

	if idx == -1 {
		return // perhaps it was for another socket server
	}

	// auth is valid, and removed from pending list

	var usernameChanged bool
	auth.Client.Mutex.Lock()
	if auth.Client.TwitchUsername == user { // recheck condition
		auth.Client.UsernameValidated = true
	} else {
		usernameChanged = true
	}
	auth.Client.Mutex.Unlock()

	if auth.Callback != nil {
		if !usernameChanged {
			auth.Callback(auth.Client, true)
		} else {
			auth.Callback(auth.Client, false)
		}
	}
}
