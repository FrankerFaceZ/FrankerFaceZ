
declare global {
	const __version_major__: number;
	const __version_minor__: number;
	const __version_patch__: number;
	const __version_prerelease__: number[];
	const __git_commit__: string | null;
	const __version_build__: string;
}

export {}
