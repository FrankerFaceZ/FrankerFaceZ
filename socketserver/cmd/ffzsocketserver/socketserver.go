package main // import "github.com/FrankerFaceZ/FrankerFaceZ/socketserver/cmd/ffzsocketserver"

import _ "net/http/pprof"

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/FrankerFaceZ/FrankerFaceZ/socketserver/certreloader"
	"github.com/FrankerFaceZ/FrankerFaceZ/socketserver/server"
)

var configFilename = flag.String("config", "config.json", "Configuration file, including the keypairs for the NaCl crypto library, for communicating with the backend.")
var flagGenerateKeys = flag.Bool("genkeys", false, "Generate NaCl keys instead of serving requests.\nArguments: [int serverId] [base64 backendPublic]\nThe backend public key can either be specified in base64 on the command line, or put in the json file later.")

var BuildTime string = "build not stamped"
var BuildHash string = "build not stamped"

func main() {
	flag.Parse()

	if *flagGenerateKeys {
		generateKeys(*configFilename)
		return
	}

	confFile, err := os.Open(*configFilename)
	if os.IsNotExist(err) {
		fmt.Println("Error: No config file. Run with -genkeys and edit config.json")
		os.Exit(3)
	}
	if err != nil {
		log.Fatal(err)
	}
	conf := &server.ConfigFile{}
	confBytes, err := ioutil.ReadAll(confFile)
	if err != nil {
		log.Fatal(err)
	}
	err = json.Unmarshal(confBytes, &conf)
	if err != nil {
		log.Fatal(err)
	}

	//	logFile, err := os.OpenFile("output.log", os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0644)
	//	if err != nil {
	//		log.Fatal("Could not create logfile: ", err)
	//	}

	server.SetupServerAndHandle(conf, http.DefaultServeMux)
	server.SetBuildStamp(BuildTime, BuildHash)

	go commandLineConsole()

	var server1, server2 *http.Server

	stopSig := make(chan os.Signal, 3)
	signal.Notify(stopSig, os.Interrupt)
	signal.Notify(stopSig, syscall.SIGUSR1)
	signal.Notify(stopSig, syscall.SIGTERM)

	if conf.UseSSL {
		reloader, err := certreloader.New(conf.SSLCertificateFile, conf.SSLKeyFile)
		if err != nil {
			log.Fatalln("Could not load TLS certificate:", err)
		}
		reloader.AutoCheck(syscall.SIGHUP)

		server1 = &http.Server{
			Addr:    conf.SSLListenAddr,
			Handler: http.DefaultServeMux,
			TLSConfig: &tls.Config{
				GetCertificate:     reloader.GetCertificateFunc(),
				GetConfigForClient: server.TLSEarlyReject,
			},
		}
		go func() {
			if err := server1.ListenAndServeTLS("", ""); err != nil {
				log.Println("ListenAndServeTLS:", err)
				stopSig <- os.Interrupt
			}
		}()
	}

	if true {
		server2 = &http.Server{
			Addr:    conf.ListenAddr,
			Handler: http.DefaultServeMux,
		}
		go func() {
			if err := server2.ListenAndServe(); err != nil {
				log.Println("ListenAndServe: ", err)
				stopSig <- os.Interrupt
			}
		}()

	}

	<-stopSig
	log.Println("Shutting down...")

	var wg sync.WaitGroup
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	wg.Add(1)
	go func() {
		defer wg.Done()
		if conf.UseSSL {
			server1.Shutdown(ctx)
		}
	}()
	wg.Add(1)
	go func() {
		defer wg.Done()
		server2.Shutdown(ctx)
	}()
	server.Shutdown(&wg)

	time.Sleep(1 * time.Second)
	wg.Wait()
}

func generateKeys(outputFile string) {
	if flag.NArg() < 1 {
		fmt.Println("Specify a numeric server ID after -genkeys")
		os.Exit(2)
	}
	if flag.NArg() >= 2 {
		server.GenerateKeys(outputFile, flag.Arg(0), flag.Arg(1))
	} else {
		server.GenerateKeys(outputFile, flag.Arg(0), "")
	}
	fmt.Println("Keys generated. Now edit config.json")
}
