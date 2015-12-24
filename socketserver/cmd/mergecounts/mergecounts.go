package main

import (
	"github.com/clarkduvall/hyperloglog"
	"flag"
	"fmt"
	"../../server"
	"net/http"
	"encoding/gob"
	"os"
)

var SERVERS = []string{
	"https://catbag.frankerfacez.com",
	"https://andknuckles.frankerfacez.com",
	"https://tuturu.frankerfacez.com",
}

const folderPrefix = "/hll/"

const HELP = `
Usage: mergecounts [filename]

Downloads the file /hll/filename from the 3 FFZ socket servers, merges the contents, and prints the total cardinality.

Filename should be in one of the following formats:

  daily-25-12-2015.gob
  weekly-51-2015.gob
  monthly-12-2015.gob
`

func main() {
	flag.Parse()
	if flag.NArg() < 1 {
		fmt.Print(HELP)
		os.Exit(2)
		return
	}

	filename := flag.Arg(1)
	hll, err := DownloadAll(filename)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
		return
	}

	fmt.Println(hll.Count())
}

func DownloadAll(filename string) (*hyperloglog.HyperLogLogPlus, error) {
	result, _ := hyperloglog.NewPlus(server.CounterPrecision)

	for _, server := range SERVERS {
		singleHLL, err := DownloadHLL(fmt.Sprintf("%s%s%s", server, folderPrefix, filename))
		if err != nil {
			return nil, err
		}
		result.Merge(singleHLL)
	}

	return result, nil
}

func DownloadHLL(url string) (*hyperloglog.HyperLogLogPlus, error) {
	result, _ := hyperloglog.NewPlus(server.CounterPrecision)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	dec := gob.NewDecoder(resp.Body)
	dec.Decode(result)
	resp.Body.Close()

	return result, nil
}
