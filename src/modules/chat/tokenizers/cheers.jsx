'use strict';

import {createElement} from 'utilities/dom';
import {has} from 'utilities/object';

// ============================================================================
// Cheers
// ============================================================================

export const CheerEmotes = {
	type: 'cheer',
	priority: 40,

	component: () => import(/* webpackChunkName: 'vue-chat' */ '../components/chat-cheer.vue'),

	render(token, createElement) {
		return (<span
			class="ffz-cheer ffz-tooltip ffz--pointer-events"
			data-tooltip-type="cheer"
			data-prefix={token.prefix}
			data-amount={this.i18n.formatNumber(token.amount)}
			data-tier={token.tier}
			data-individuals={JSON.stringify(token.individuals || null)}
			alt={token.text}
		/>);
	},

	tooltip(target) {
		const ds = target.dataset,
			amount = parseInt(ds.amount.replace(/,/g, ''), 10),
			prefix = ds.prefix,
			tier = ds.tier,
			individuals = ds.individuals && JSON.parse(ds.individuals),
			length = individuals && individuals.length;

		const out = [
			this.context.get('tooltip.emote-images') && (<div
				class="preview-image ffz-cheer-preview"
				data-prefix={prefix}
				data-tier={tier}
			/>),
			this.i18n.t('tooltip.bits', '{count,number} Bits', amount),
		];

		if ( length > 1 ) {
			out.push(<br />);

			individuals.sort(i => -i[0]);

			for(let i=0; i < length && i < 12; i++) {
				const [amount, tier, prefix] = individuals[i];
				out.push(this.tokenizers.cheer.render.call(this, {
					amount,
					prefix,
					tier
				}, createElement));
			}

			if ( length > 12 ) {
				out.push(<br />);
				out.push(this.i18n.t('tooltip.bits.more', '(and {count, number} more)', length-12));
			}
		}

		return out;
	},

	process(tokens, msg) {
		if ( ! tokens || ! tokens.length || ! msg.bits )
			return;

		const room = this.getRoom(msg.roomID, msg.roomLogin, true),
			actions = room && room.bitsConfig;

		if ( ! actions )
			return;

		const matcher = new RegExp(`^(${Object.keys(actions).join('|')})(\\d+)$`, 'i');

		const out = [],
			collected = {},
			collect = this.context.get('chat.bits.stack');

		for(const token of tokens) {
			if ( ! token || token.type !== 'text' ) {
				out.push(token);
				continue;
			}

			let text = [];
			for(const segment of token.text.split(/ +/)) {
				const match = matcher.exec(segment);
				if ( match ) {
					const prefix = match[1].toLowerCase(),
						cheer = actions[prefix];

					if ( ! cheer ) {
						text.push(segment);
						continue;
					}

					const amount = parseInt(match[2], 10),
						tiers = cheer.tiers;

					let tier, token;
					for(let i=0, l = tiers.length; i < l; i++)
						if ( amount >= tiers[i].amount ) {
							tier = i;
							break;
						}

					if ( text.length ) {
						// We have pending text. Join it together, with an extra space.
						out.push({type: 'text', text: `${text.join(' ')} `});
						text = [];
					}

					out.push(token = {
						type: 'cheer',
						prefix,
						tier,
						amount,
						text: match[0]
					});

					if ( collect ) {
						let pref = collect === 2 ? 'cheer' : prefix;
						if ( ! actions[pref] )
							pref = prefix;

						const group = collected[pref] = collected[pref] || {total: 0, individuals: []};

						group.total += amount;
						group.individuals.push([amount, tier, prefix]);
						token.hidden = true;
					}

					text.push('');

				} else
					text.push(segment);
			}

			if ( text.length > 1 || (text.length === 1 && text[0] !== '') )
				out.push({type: 'text', text: text.join(' ')});
		}

		if ( collect ) {
			for(const prefix in collected)
				if ( has(collected, prefix) ) {
					const cheers = collected[prefix],
						cheer = actions[prefix],
						tiers = cheer.tiers;

					let tier = 0;
					for(let l = tiers.length; tier < l; tier++)
						if ( cheers.total >= tiers[tier].amount )
							break;

					out.unshift({
						type: 'cheer',
						prefix,
						tier,
						amount: cheers.total,
						individuals: cheers.individuals,
						length: 0
					});
				}
		}

		return out;
	}
}
