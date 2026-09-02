'use strict';

// ============================================================================
// Emote Menu: EmojiSection
// Menu section variant that renders emoji from the sprite sheet. Built at runtime because React comes from Twitch; `t` is the EmoteMenu module.
// ============================================================================



export function createEmojiSection(t, React, MenuSection) {
	const createElement = React && React.createElement;

	return class FFZMenuEmojiSection extends MenuSection {
		renderEmote(emote, locked, source, sellout) {
			const emoji_x = (emote.x * (t.emoji_size + 2)) + 1,
				emoji_y = (emote.y * (t.emoji_size + 2)) + 1,

				x_pct = 100 * emoji_x / t.emoji_sheet_remain,
				y_pct = 100 * emoji_y / t.emoji_sheet_remain,

				tt = t.chat.context.get('chat.emote-menu.tooltips');

			return (<button
				key={emote.id}
				class={`${tt ? 'ffz-tooltip ' : ''}emote-picker__emote-link${locked ? ' locked' : ''}${emote.emoji ? ' emote-picker__emoji' : ''}`}
				data-tooltip-type="emote"
				data-provider={emote.provider}
				data-id={emote.id}
				data-set={emote.set_id}
				data-code={emote.code}
				data-variant={emote.variant}
				data-no-source={source}
				data-name={emote.name}
				aria-label={emote.name}
				data-locked={emote.locked}
				data-sellout={sellout}
				onClick={!emote.locked && this.clickEmote}
			>
				<figure
					class="emote-picker__emote-figure"
					style={{
						backgroundPosition: `${x_pct}% ${y_pct}%`,
					}}
				/>
				{emote.favorite && <figure class="ffz--favorite ffz-i-star" />}
				{locked && <figure class={`ffz-i-${emote.lock_icon || 'lock'}`} />}
			</button>)
		}
	};
}
