package main // import "bitbucket.org/stendec/frankerfacez/socketserver/cmd/socketserver"

import (
	"flag"
	"../../internal/server"
	"log"
	"net/http"
)

var origin *string = flag.String("origin", "localhost:8001", "Client-visible origin of the socket server")
var bindAddress *string = flag.String("listen", "", "Address to bind to, if different from origin")
var certificateFile *string = flag.String("crt", "", "SSL certificate file")
var privateKeyFile *string = flag.String("key", "", "SSL private key file")

func main() {
	flag.Parse()

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
		UseSSL: *certificateFile != "",

		SocketOrigin: *origin,
	}

	server.SetupServerAndHandle(conf)

	var err error
	if conf.UseSSL {
		err = http.ListenAndServeTLS(*bindAddress, *certificateFile, *privateKeyFile, nil)
	} else {
		err = http.ListenAndServe(*bindAddress, nil)
	}

	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
