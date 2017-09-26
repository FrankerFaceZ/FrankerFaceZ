// Copyright 2016 Michael Stapelberg, BSD-3
//
// https://stackoverflow.com/a/40883377/1210278
package certreloader

import (
	"crypto/tls"
	"log"
	"os"
	"os/signal"
	"sync"
)

type CertSource struct {
	certMu   sync.RWMutex
	cert     *tls.Certificate
	certPath string
	keyPath  string
}

// Create a CertSource
func New(certPath, keyPath string) (*CertSource, error) {
	result := &CertSource{
		certPath: certPath,
		keyPath:  keyPath,
	}
	cert, err := tls.LoadX509KeyPair(certPath, keyPath)
	if err != nil {
		return nil, err
	}
	result.cert = &cert
	return result, nil
}

// Automatically reload certificate on the provided signal
func (kpr *CertSource) AutoCheck(sig os.Signal) {
	go func() {
		c := make(chan os.Signal, 1)
		signal.Notify(c, sig)
		for range c {
			log.Printf("Received %v, reloading TLS certificate and key from %q and %q", sig, kpr.certPath, kpr.keyPath)
			if err := kpr.maybeReload(); err != nil {
				log.Printf("Keeping old TLS certificate because the new one could not be loaded: %v", err)
			}
		}
	}()
}

// Check() can be called manually to reload the certificate
func (kpr *CertSource) Check() error {
	return kpr.maybeReload()
}

func (kpr *CertSource) maybeReload() error {
	newCert, err := tls.LoadX509KeyPair(kpr.certPath, kpr.keyPath)
	if err != nil {
		return err
	}
	kpr.certMu.Lock()
	defer kpr.certMu.Unlock()
	kpr.cert = &newCert
	return nil
}

// Returns a tls.Config.GetCertificate function.
func (kpr *CertSource) GetCertificateFunc() func(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	return func(clientHello *tls.ClientHelloInfo) (*tls.Certificate, error) {
		kpr.certMu.RLock()
		defer kpr.certMu.RUnlock()
		return kpr.cert, nil
	}
}
