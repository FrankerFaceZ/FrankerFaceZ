'use strict';

// ============================================================================
// Emote Menu: EmojiTonePicker
// Skin tone picker shown in the emoji section. Built at runtime because React comes from Twitch; `t` is the EmoteMenu module.
// ============================================================================

import {ClickOutside} from 'utilities/dom';

export function createEmojiTonePicker(t, React) {
	const createElement = React && React.createElement;

	return class FFZEmojiTonePicker extends React.Component {
		constructor(props) {
			super(props);

			this.onClick = () => this.setState({open: ! this.state.open});
			this.onMouseEnter = () => this.state.open || this.setState({emoji: this.pickRandomEmoji()});
			this.onClickOutside = () => this.state.open && this.setState({open: false});

			this.clickTone = event => {
				this.props.pickTone(event.currentTarget.dataset.tone);
				this.setState({open: false});
			}

			this.element = null;
			this.saveRef = element => this.element = element;

			this.state = {
				open: false,
				emoji: this.pickRandomEmoji(),
				tone: null
			}
		}

		componentDidMount() {
			if ( this.element )
				this._clicker = new ClickOutside(this.element, this.onClickOutside);
		}

		componentWillUnmount() {
			if ( this._clicker ) {
				this._clicker.destroy();
				this._clicker = null;
			}
		}

		pickRandomEmoji() {  
			const possibilities = this.props.choices,
				pick = Math.floor(Math.random() * possibilities.length);

			return possibilities[pick];
		}

		renderTone(data, tone) {
			if ( ! data )
				return null;

			return (<button
				key={data.code}
				data-tone={tone}
				class="tw-interactive tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive tw-pd-y-05 tw-pd-x-2"
				onClick={this.clickTone}
			>
				{this.renderEmoji(data)}
			</button>)
		}

		renderToneMenu() {
			if ( ! this.state.open )
				return null;

			const emoji = this.state.emoji;
			if ( ! emoji || ! emoji.variants )
				return null;

			const tones = Object.entries(emoji.variants).map(([tone, emoji]) => this.renderTone(emoji, tone));

			return (<div class="tw-absolute ffz-balloon ffz-il-tooltip--up ffz-il-tooltip--align-right ffz-balloon tw-block">
				<div class="tw-border-b tw-border-l tw-border-r tw-border-t tw-border-radius-medium tw-c-background-base tw-elevation-1">
					{this.renderTone(emoji, null)}
					{tones}
				</div>
			</div>);
		}

		renderEmoji(data) {  
			if ( ! data )
				return null;

			const emoji_x = (data.sheet_x * (t.emoji_size + 2)) + 1,
				emoji_y = (data.sheet_y * (t.emoji_size + 2)) + 1,

				x_pct = 100 * emoji_x / t.emoji_sheet_remain,
				y_pct = 100 * emoji_y / t.emoji_sheet_remain;

			return (<figure
				class="ffz--emoji-tone-picker__emoji"
				style={{
					backgroundPosition: `${x_pct}% ${y_pct}%`
				}}
			/>)
		}

		render() {
			const emoji = this.state.emoji,
				tone = this.props.tone,
				toned = tone && emoji.variants[tone];

			return (<div ref={this.saveRef} class="ffz--emoji-tone-picker tw-relative tw-mg-l-1">
				<button
					class="tw-interactive tw-button tw-button--dropmenu ffz-button--hollow"
					onClick={this.onClick}
					onMouseEnter={this.onMouseEnter}
				>
					<span class="tw-button__text">
						{this.renderEmoji(toned || emoji)}
					</span>
					<span class="tw-button__icon tw-button__icon--right">
						<figure class="ffz-i-down-dir" />
					</span>
				</button>
				{this.renderToneMenu()}
			</div>)
		}
	};
}
