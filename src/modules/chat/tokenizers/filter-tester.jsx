'use strict';


export const FilterTester = {
	type: 'filter_test',
	priority: 1000,

	render(token, createElement) {
		if ( ! token.msg.filters?.length )
			return null;

		return (<div class="ffz-pill tw-mg-l-1">
			{ token.msg.filters.join(', ') }
		</div>);
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length || ! this.context.get('chat.filtering.debug') )
			return;

		msg.filters = [];

		tokens.push({
			type: 'filter_test',
			msg
		});

		return tokens;
	}
}
