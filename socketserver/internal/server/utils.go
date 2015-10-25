package server

import (
	"crypto/rand"
)

func FillCryptoRandom(buf []byte) error {
	remaining := len(buf)
	for remaining > 0 {
		count, err := rand.Read(buf)
		if err != nil {
			return err
		}
		remaining -= count
	}
	return nil
}

func NewByteBuffer() interface{} {
	return make([]byte, 1024)
}

func AddToSliceS(ary *[]string, val string) bool {
	slice := *ary
	for _, v := range slice {
		if v == val {
			return false
		}
	}

	slice = append(slice, val)
	*ary = slice
	return true
}

func RemoveFromSliceS(ary *[]string, val string) bool {
	slice := *ary
	var idx int = -1
	for i, v := range slice {
		if v == val {
			idx = i
			break
		}
	}
	if idx == -1 {
		return false
	}

	slice[idx] = slice[len(slice) - 1]
	slice = slice[:len(slice) - 1]
	*ary = slice
	return true
}

func AddToSliceC(ary *[]chan <- ClientMessage, val chan <- ClientMessage) bool {
	slice := *ary
	for _, v := range slice {
		if v == val {
			return false
		}
	}

	slice = append(slice, val)
	*ary = slice
	return true
}

func RemoveFromSliceC(ary *[]chan <- ClientMessage, val chan <- ClientMessage) bool {
	slice := *ary
	var idx int = -1
	for i, v := range slice {
		if v == val {
			idx = i
			break
		}
	}
	if idx == -1 {
		return false
	}

	slice[idx] = slice[len(slice) - 1]
	slice = slice[:len(slice) - 1]
	*ary = slice
	return true
}