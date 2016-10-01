package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type ConfigFile struct {
	ListenAddr       string
	DatabaseLocation string
	GobFilesLocation string
}

func makeConfig() {
	config.ListenAddr = "localhost:3000"
	home, ok := os.LookupEnv("HOME")
	if ok {
		config.DatabaseLocation = fmt.Sprintf("%s/.ffzstatsweb/database.sqlite", home)
		config.GobFilesLocation = fmt.Sprintf("%s/.ffzstatsweb/gobcache", home)
		os.MkdirAll(config.GobFilesLocation, 0755)
	} else {
		config.DatabaseLocation = "./database.sqlite"
		config.GobFilesLocation = "./gobcache"
		os.MkdirAll(config.GobFilesLocation, 0755)
	}
	file, err := os.Create(*configLocation)
	if err != nil {
		fmt.Printf("Error: could not create config file: %v\n", err)
		os.Exit(ExitCodeBadConfig)
		return
	}
	enc := json.NewEncoder(file)
	err = enc.Encode(config)
	if err != nil {
		fmt.Printf("Error: could not write config file: %v\n", err)
		os.Exit(ExitCodeBadConfig)
		return
	}
	err = file.Close()
	if err != nil {
		fmt.Printf("Error: could not write config file: %v\n", err)
		os.Exit(ExitCodeBadConfig)
		return
	}
	return
}

func loadConfig() {
	file, err := os.Open(*configLocation)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Println("You must create a config file with -genconf")
		} else {
			fmt.Printf("Error: could not load config file: %v", err)
		}
		os.Exit(ExitCodeBadConfig)
		return
	}
	dec := json.NewDecoder(file)
	err = dec.Decode(&config)
	if err != nil {
		fmt.Printf("Error: could not load config file: %v\n", err)
		os.Exit(ExitCodeBadConfig)
		return
	}
	err = file.Close()
	if err != nil {
		fmt.Printf("Error: could not load config file: %v\n", err)
		os.Exit(ExitCodeBadConfig)
		return
	}
	return
}
