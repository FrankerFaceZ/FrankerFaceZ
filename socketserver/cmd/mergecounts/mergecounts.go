package main

import (
	"encoding/gob"
	"flag"
	"fmt"
	"net/http"
	"os"

	"github.com/FrankerFaceZ/FrankerFaceZ/socketserver/server"
	"github.com/clarkduvall/hyperloglog"
)

var SERVERS = []string{
	"https://catbag.frankerfacez.com",
	"https://andknuckles.frankerfacez.com",
	"https://tuturu.frankerfacez.com",
	"https://yoohoo.frankerfacez.com",
	"https://lilz.frankerfacez.com",
	"https://pog.frankerfacez.com",
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

var forceWrite = flag.Bool("f", false, "force servers to write out their current")

func main() {
	flag.Parse()
	if flag.NArg() < 1 {
		fmt.Print(HELP)
		os.Exit(2)
		return
	}

	filename := flag.Arg(0)
	hll, err := DownloadAll(filename)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
		return
	}

	fmt.Println(hll.Count())
}

func ForceWrite() {
	for _, server := range SERVERS {
		resp, err := http.Get(fmt.Sprintf("%s/hll_force_write", server))
		if err != nil {
			fmt.Println(err)
			os.Exit(1)
		}
		resp.Body.Close()
	}
}

func DownloadAll(filename string) (*hyperloglog.HyperLogLogPlus, error) {
	result, _ := hyperloglog.NewPlus(server.CounterPrecision)

	for _, server := range SERVERS {
		if *forceWrite {
			resp, err := http.Get(fmt.Sprintf("%s/hll_force_write", server))
			if err == nil {
				resp.Body.Close()
			}
		}
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
	defer resp.Body.Close()
	dec := gob.NewDecoder(resp.Body)
	err = dec.Decode(result)
	if err != nil {
		return nil, err
	}
	fmt.Println(url, result.Count())

	return result, nil
}
