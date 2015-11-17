package server

// #include <unistd.h>
// long get_ticks_per_second() {
//   return sysconf(_SC_CLK_TCK);
// }
import "C"

var ticksPerSecond = int(C.get_ticks_per_second())
