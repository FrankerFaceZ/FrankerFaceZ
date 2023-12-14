declare module '@ffz/icu-msgparser' {

	export type MessageAST = MessageNode[];

	export type MessageNode = string | MessagePlaceholder;

	export type MessagePlaceholder = MessageTag | MessageVariable;

	export type MessageTag = {
		n: string;
		v: never;
		t: never;
		c?: MessageAST;
	};

	export type MessageVariable = {
		n: never;
		v: string;
		t?: string;
		f?: string | number;
		o?: MessageSubmessages;
	};

	export type MessageSubmessages = {
		[rule: string]: MessageAST;
	};

	export type ParserOptions = {
		OPEN: string;
		CLOSE: string;
		SEP: string;
		ESCAPE: string;
		SUB_VAR: string;
		TAG_OPEN: string;
		TAG_CLOSE: string;
		TAG_CLOSING: string;

		OFFSET: string;

		subnumeric_types: string[];
		submessage_types: string[];

		allowTags: boolean;
		requireOther: boolean | string[];
	}

	export default class Parser {

		constructor(options?: Partial<ParserOptions>);

		parse(input: string): MessageAST;

	}

}