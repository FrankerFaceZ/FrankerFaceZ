package server

func copyString(s string) string {
	return string([]byte(s))
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

	slice[idx] = slice[len(slice)-1]
	slice = slice[:len(slice)-1]
	*ary = slice
	return true
}

func AddToSliceCl(ary *[]*ClientInfo, val *ClientInfo) bool {
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

func RemoveFromSliceCl(ary *[]*ClientInfo, val *ClientInfo) bool {
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

	slice[idx] = slice[len(slice)-1]
	slice = slice[:len(slice)-1]
	*ary = slice
	return true
}
