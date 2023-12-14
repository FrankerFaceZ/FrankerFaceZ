
export interface ScreenDetailed extends Screen {

	readonly availLeft: number;
	readonly availTop: number;
	readonly devicePixelRatio: number;
	readonly isInternal: boolean;
	readonly isPrimary: boolean;
	readonly label: string;
	readonly left: number;
	readonly top: number;

}

export interface ScreenDetails extends EventTarget {

	readonly currentScreen: ScreenDetailed;

	readonly screens: ScreenDetailed[];

}

declare global {

	interface Window {
		getScreenDetails: (() => Promise<ScreenDetails>) | undefined;
	}

}

export {}
