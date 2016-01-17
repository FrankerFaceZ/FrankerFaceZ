package main

import (
	"net/http"
	"flag"
	"github.com/clarkduvall/hyperloglog"
	"time"
	"bitbucket.org/stendec/frankerfacez/socketserver/server"
)

var configLocation = flag.String("config", "./config.json", "Location of the configuration file. Defaults to ./config.json")
var genConfig = flag.Bool("genconf", false, "Generate a new configuration file.")

var config ConfigFile

const ExitCodeBadConfig = 2

func main() {
	flag.Parse()

	if *genConfig {
		makeConfig()
		return
	}

	loadConfig()

	http.ListenAndServe(config.ListenAddr, http.DefaultServeMux)
}

func combineDateRange(from time.Time, to time.Time, dest *hyperloglog.HyperLogLogPlus) error {
	from = server.TruncateToMidnight(from)
	to = server.TruncateToMidnight(to)
	year, month, day := from.Date()
	for current := from; current.Before(to); day = day + 1 {
		current = time.Date(year, month, day, 0, 0, 0, 0, server.CounterLocation)

	}
	return nil
}