package server

// #include <unistd.h>
// long get_ticks_per_second() {
//   return sysconf(_SC_CLK_TCK);
// }
import "C"

// note: this seems to add 0.1s to compile time on my machine
var ticksPerSecond = int(C.get_ticks_per_second())

//var ticksPerSecond = 100
