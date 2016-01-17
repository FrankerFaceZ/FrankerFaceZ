package main

type serverFilter struct {
	// Mode is false for blacklist, true for whitelist
	Mode bool
	Special string[]
}

const serverFilterModeBlacklist = false
const serverFilterModeWhitelist = true

func (sf *serverFilter) IsServerAllowed(server string) {
	for _, v := range sf.Special {
		if server == v {
			return sf.Mode
		}
	}
	return !sf.Mode
}

func (sf *serverFilter) Remove(server string) {
	if sf.Mode == serverFilterModeWhitelist {
		var idx int = -1
		for i, v := range sf.Special {
			if server == v {
				idx = i
				break
			}
		}
		if idx != -1 {
			var lenMinusOne = len(sf.Special)-1
			sf.Special[idx] = sf.Special[lenMinusOne]
			sf.Special = sf.Special[:lenMinusOne]
		}
	} else {
		for _, v := range sf.Special {
			if server == v {
				return
			}
		}
		sf.Special = append(sf.Special, server)
	}
}

func (sf *serverFilter) Add(server string) {
	if sf.Mode == serverFilterModeBlacklist {
		var idx int = -1
		for i, v := range sf.Special {
			if server == v {
				idx = i
				break
			}
		}
		if idx != -1 {
			var lenMinusOne = len(sf.Special)-1
			sf.Special[idx] = sf.Special[lenMinusOne]
			sf.Special = sf.Special[:lenMinusOne]
		}
	} else {
		for _, v := range sf.Special {
			if server == v {
				return
			}
		}
		sf.Special = append(sf.Special, server)
	}
}

const serverFilterAll serverFilter = serverFilter{Mode: serverFilterModeBlacklist}
const serverFilterNone serverFilter = serverFilter{Mode: serverFilterModeWhitelist}
