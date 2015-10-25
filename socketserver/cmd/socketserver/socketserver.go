package main // import "bitbucket.org/stendec/frankerfacez/socketserver/cmd/socketserver"

import (
	"flag"
	"log"
	"net/http"
	"../../internal/server"
)

var origin *string = flag.String("origin", "localhost:8001", "Client-visible origin of the socket server")
var bindAddress *string = flag.String("listen", "", "Address to bind to, if different from origin")
var usessl *bool = flag.Bool("ssl", false, "Enable the use of SSL for connecting clients and backend connections")
var certificateFile *string = flag.String("crt", "ssl.crt", "CA-signed SSL certificate file")
var privateKeyFile *string = flag.String("key", "ssl.key", "SSL private key file")

var naclKeysFile *string = flag.String("naclkey", "naclkeys.json", "Keypairs for the NaCl crypto library, for communicating with the backend.")
var generateKeys *bool = flag.Bool("genkeys", false, "Generate NaCl keys instead of serving requests.\nArguments: [int serverId] [base64 backendPublic]\nThe backend public key can either be specified in base64 on the command line, or put in the json file later.")

func main() {
	flag.Parse()

	if *generateKeys {
		GenerateKeys(*naclKeysFile)
		return
	}

	if *origin == "" {
		log.Fatalln("--origin argument required")
	}
	if *bindAddress == "" {
		bindAddress = origin
	}
	if (*certificateFile == "") != (*privateKeyFile == "") {
		log.Fatalln("Either both --crt and --key can be provided, or neither.")
	}

	conf := &server.Config {
		SSLKeyFile: *privateKeyFile,
		SSLCertificateFile: *certificateFile,
		UseSSL: *usessl,
		NaclKeysFile: *naclKeysFile,

		SocketOrigin: *origin,
	}

	httpServer := &http.Server{
		Addr: *bindAddress,
	}

	server.SetupServerAndHandle(conf, httpServer.TLSConfig)

	var err error
	if conf.UseSSL {
		err = httpServer.ListenAndServeTLS(*certificateFile, *privateKeyFile)
	} else {
		err = httpServer.ListenAndServe()
	}

	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}


func GenerateKeys(outputFile string) {
	if flag.NArg() < 1 {
		log.Fatal("The server ID must be specified")
	}
	if flag.NArg() >= 2 {
		server.GenerateKeys(outputFile, flag.Arg(0), flag.Arg(1))
	} else {
		server.GenerateKeys(outputFile, flag.Arg(0), "")
	}
}