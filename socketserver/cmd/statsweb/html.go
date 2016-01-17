package main

import (
	"html/template"
	"net/http"
	"time"
	"bitbucket.org/stendec/frankerfacez/socketserver/server"
)

type CalendarData struct {
	Weeks []CalWeekData
}
type CalWeekData struct {
	Days []CalDayData
}
type CalDayData struct {
	NoData bool
	Date int
	UniqUsers int
}

type CalendarMonthInfo struct {
	Year int
	Month time.Month
	// Ranges from -5 to +1.
	// A value of +1 means the 1st of the month is a Sunday.
	// A value of 0 means the 1st of the month is a Monday.
	// A value of -5 means the 1st of the month is a Saturday.
	FirstSundayOffset int
	// True if the calendar for this month needs six sundays.
	NeedSixSundays bool
}

func GetMonthInfo(at time.Time) CalendarMonthInfo {
	year, month, _ := at.Date()
	// 1 (start of month) - weekday of start of month = day offset of start of week at start of month
	monthWeekStartDay := 1 - time.Date(year, month, 1, 0, 0, 0, 0, server.CounterLocation).Weekday()
	// first day on calendar + 6 weeks < end of month?
	sixthSundayDay := monthWeekStartDay + 5*7
	sixthSundayDate := time.Date(year, month, sixthSundayDay, 0, 0, 0, 0, server.CounterLocation)
	var needSixSundays bool = false
	if sixthSundayDate.Month() == month {
		needSixSundays = true
	}

	return CalendarMonthInfo{
		Year: year,
		Month: month,
		FirstSundayOffset: monthWeekStartDay,
		NeedSixSundays: needSixSundays,
	}
}

func renderCalendar(w http.ResponseWriter, at time.Time) {
	layout, err := template.ParseFiles("./webroot/layout.template.html", "./webroot/cal_entry.hbs", "./webroot/calendar.hbs")
	data := CalendarData{}
	data.Weeks = make([]CalWeekData, 6)

}
