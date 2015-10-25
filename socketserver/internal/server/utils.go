package server

import (
)

func AddToSliceS(ary *[]string, val string) {
	slice := *ary
	for _, v := range slice {
		if v == val {
			return
		}
	}

	slice = append(slice, val)
	*ary = slice
}

func RemoveFromSliceS(ary *[]string, val string) {
	slice := *ary
	var idx int = -1
	for i, v := range slice {
		if v == val {
			idx = i
			break
		}
	}
	if idx == -1 {
		return
	}

	slice[idx] = slice[len(slice) - 1]
	slice = slice[:len(slice) - 1]
	*ary = slice
}
