'use strict';

export function getBuster(resolution = 5) {
	const now = Math.floor(Date.now() / 1000);
	return now - (now % resolution);
}

export function duration_to_string(elapsed, separate_days, days_only, no_hours, no_seconds) {
	const seconds = elapsed % 60;
	let minutes = Math.floor(elapsed / 60),
		hours = Math.floor(minutes / 60),
		days = '';

	minutes = minutes % 60;

	if ( separate_days ) {
		days = Math.floor(hours / 24);
		hours = hours % 24;
		if ( days_only && days > 0 )
			return `${days} days`;

		days = days > 0 ? `${days} days, ` : '';
	}

	const show_hours = (!no_hours || days || hours);

	return `${days}${
		show_hours ? `${days && hours < 10 ? '0' : ''}${hours}:` : ''
	}${show_hours && minutes < 10 ? '0' : ''}${minutes}${
		no_seconds ? '' : `:${seconds < 10 ? '0' : ''}${seconds}`}`;
}


export function print_duration(seconds) {
	let minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	minutes %= 60;
	seconds %= 60;

	return `${hours > 0 ? `${hours}:${minutes < 10 ? '0' : ''}` : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}


export function durationForChat(elapsed) {
	const seconds = elapsed % 60;
	let minutes = Math.floor(elapsed / 60);
	let hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	minutes = minutes % 60;
	hours = hours % 24;

	return `${days > 0 ? `${days}d` : ''}${hours > 0 ? `${hours}h` : ''}${minutes > 0 ? `${minutes}m` : ''}${seconds > 0 ? `${seconds}s` : ''}`;
}


export function durationForURL(elapsed) {
	const seconds = elapsed % 60;
	let minutes = Math.floor(elapsed / 60);
	const hours = Math.floor(minutes / 60);

	minutes = minutes % 60;

	return `${hours > 0 ? `${hours}h` : ''}${minutes > 0 ? `${minutes}m` : ''}${seconds > 0 ? `${seconds}s` : ''}`;
}