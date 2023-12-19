
export function getBuster(resolution: number = 5) {
	const now = Math.floor(Date.now() / 1000);
	return now - (now % resolution);
}

export function duration_to_string(
	elapsed: number,
	separate_days?: boolean,
	days_only?: boolean,
	no_hours?: boolean,
	no_seconds?: boolean
) {
	const seconds = elapsed % 60;
	let minutes = Math.floor(elapsed / 60),
		hours = Math.floor(minutes / 60),
		days = '';

	minutes = minutes % 60;

	if ( separate_days ) {
		const day_count = Math.floor(hours / 24);
		hours = hours % 24;
		if ( days_only && day_count > 0 )
			return `${days} days`;

		days = day_count > 0 ? `${day_count} days, ` : '';
	}

	const show_hours = (no_hours === false || days?.length > 0 || hours > 0);

	return `${days}${
		show_hours ? `${days && hours < 10 ? '0' : ''}${hours}:` : ''
	}${show_hours && minutes < 10 ? '0' : ''}${minutes}${
		no_seconds ? '' : `:${seconds < 10 ? '0' : ''}${seconds}`}`;
}


export function print_duration(seconds: number) {
	let minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	minutes %= 60;
	seconds %= 60;

	return `${hours > 0 ? `${hours}:${minutes < 10 ? '0' : ''}` : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}


export function durationForChat(elapsed: number) {
	const seconds = elapsed % 60;
	let minutes = Math.floor(elapsed / 60);
	let hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	minutes = minutes % 60;
	hours = hours % 24;

	return `${days > 0 ? `${days}d` : ''}${hours > 0 ? `${hours}h` : ''}${minutes > 0 ? `${minutes}m` : ''}${seconds > 0 ? `${seconds}s` : ''}`;
}


export function durationForURL(elapsed: number) {
	const seconds = elapsed % 60;
	let minutes = Math.floor(elapsed / 60);
	const hours = Math.floor(minutes / 60);

	minutes = minutes % 60;

	return `${hours > 0 ? `${hours}h` : ''}${minutes > 0 ? `${minutes}m` : ''}${seconds > 0 ? `${seconds}s` : ''}`;
}
