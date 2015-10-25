package main // import "bitbucket.org/stendec/frankerfacez/socketserver/cmd/socketserver"

import (
	"flag"
	"../../internal/server"
	"log"
	"net/http"
)

var origin *string = flag.String("origin", "localhost:8001", "Client-visible origin of the socket server")
var bindAddress *string = flag.String("listen", "", "Address to bind to, if different from origin")
var usessl *bool = flag.Bool("ssl", false, "Enable the use of SSL for connecting clients and backend connections")
var certificateFile *string = flag.String("crt", "ssl.crt", "CA-signed SSL certificate file")
var privateKeyFile *string = flag.String("key", "ssl.key", "SSL private key file")
var backendRootFile *string = flag.String("peerroot", "backend_issuer.pem", "Root certificate that issued client certificates for backend servers")
var backendCertFile *string = flag.String("peercrt", "backend_cert.crt", "Backend-trusted certificate, for use as a client certificate")
var backendKeyFile *string = flag.String("peerkey", "backend_cert.key", "Private key for backend-trusted certificate, for use as a client certificate")
var basicAuthPwd *string = flag.String("password", "", "Password for HTTP Basic Auth") // TODO

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
		BackendRootCertFile: *backendRootFile,
		BackendClientCertFile: *backendCertFile,
		BackendClientKeyFile: *backendKeyFile,

		SocketOrigin: *origin,
	}

	httpServer := &http.Server{
		Addr: *bindAddress
	}

	server.SetupServerAndHandle(conf, httpServer.TLSConfig)

	var err error
	if conf.UseSSL {
		err = httpServer.ListenAndServeTLS(nil, nil)
	} else {
		err = httpServer.ListenAndServe()
	}

	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
