'use strict';

// ============================================================================
// Chat Line Types
// Renderers for each kind of FFZ-rendered chat line. `line` is
// the module instance; every callback uses it where it used to use `this`.
// ============================================================================

import {getRewardTitle, getRewardCost, doesRewardCostBits} from './points';
import awaitMD, {getMD} from 'utilities/markdown';


const SUB_TIERS = {
	1000: 1,
	2000: 2,
	3000: 3
};


export function defineLineTypes(line) {

	line.line_types = {};

	line.line_types.unknown = {
		renderNotice: (msg, current_user, room, inst, e) => {
			return `Unknown message type: ${msg.ffz_type}`
		}
	};

	line.line_types.notice = {
		renderNotice: (msg, current_user, room, inst, e) => {
			const data = msg.ffz_data;
			let content = line.line_types.notice.renderContent(msg, current_user, room, inst, e);

			if ( ! data.icon )
				return content;

			if ( typeof content === 'string' )
				content = e('span', {}, content);

			if ( typeof data.icon === 'function' ) {
				try {
					content.ffz_icon = data.icon(data, inst, e);
				} catch(err) {
					line.log.capture(err);
					line.log.error('Error using custom renderer for notice:', err);
				}

			} else if ( data.icon instanceof URL )
				content.ffz_icon = e('img', {
					className: 'ffz-notice-icon tw-mg-r-05',
					src: data.icon.toString()
				});

			else
				content.ffz_icon = e('span', {
					className: `${data.icon} tw-mg-r-05`
				});

			return content;
		},

		renderContent: (msg, current_user, room, inst, e) => {
			const data = msg.ffz_data;
			if ( data.renderer )
				try {
					return data.renderer(data, inst, e);
				} catch(err) {
					line.log.capture(err);
					line.log.error('Error using custom renderer for notice:', err);
					return `Error rendering notice.`
				}

			const text = data.i18n ? line.i18n.t(data.i18n, data.messgae, data) : data.message;

			if ( data.markdown ) {
				const md = getMD();
				if ( ! md ) {
					awaitMD().then(() => inst.forceUpdate());
					return 'Loading...';
				}

				return e('span', {
					dangerouslySetInnerHTML: {
						__html: getMD().renderInline(text)
					}
				});
			}

			if ( data.tokenize ) {
				const tokens = data.ffz_tokens = data.ffz_tokens || line.chat.tokenizeMessage({
					badges: {},
					message: text,
					id: msg.id,
					user: msg.user,
					roomLogin: msg.roomLogin,
					roomID: msg.roomID
				});

				return line.chat.renderTokens(tokens, e);
			}

			return text;
		}
	};

	line.line_types.hype = {
		renderNotice: (msg, current_user, room, inst, e) => {
			const setting = line.chat.context.get('chat.hype.message-style');
			if ( setting === 0 )
				return null;

			// We need to get the message's tokens to see if it has a message or not.
			const user = msg.user,
				tokens = msg.ffz_tokens = msg.ffz_tokens || line.chat.tokenizeMessage(msg, current_user),
				has_message = tokens.length > 0;

			let amount = msg.hype_amount;
			const digits = msg.hype_exponent ?? 0;
			if ( digits > 0 )
				amount /= Math.pow(10, digits);

			try {
				// TODO: Cache formatter?
				const fmt = new Intl.NumberFormat(navigator.languages, {
					style: 'currency',
					currency: msg.hype_currency,
					compactDisplay: 'short',
					minimumFractionDigits: digits,
					maximumFractionDigits: digits
				});

				amount = fmt.format(amount);

			} catch(err) {
				amount = `${msg.hype_currency} ${amount}`;
			}

			if (! has_message)
				return line.i18n.tList('chat.hype-chat.user', '{user} sent a Hype Chat for {amount}!', {
					amount,
					user: e('span', {
						role: 'button',
						className: 'chatter-name',
						onClick: inst.ffz_user_click_handler,
						onContextMenu: line.actions.handleUserContext
					}, e('span', {
						className: 'tw-c-text-base tw-strong'
					}, user.displayName))
				});

			return line.i18n.tList(
				'chat.hype-chat',
				'Sent a Hype Chat for {amount}!',
				{
					amount
				}
			)
		}
	};

	line.line_types.cheer = {
		renderNotice: (msg, current_user, room, inst, e) => {
			return line.i18n.tList(
				'chat.bits-message',
				'Cheered {count, plural, one {# Bit} other {# Bits}}',
				{
					count: msg.bits || 0
				}
			);
		}
	};

	line.line_types.points = {
		getClass: (msg) => {
			const highlight = msg.ffz_reward_highlight && line.chat.context.get('chat.points.allow-highlight') === 2;

			return `ffz--points-line tw-pd-l-1 tw-pd-r-2 ${highlight ? 'ffz-custom-color ffz--points-highlight' : ''}`;
		},

		renderNotice: (msg, current_user, room, inst, e) => {
			if ( ! msg.ffz_reward )
				return null;

			// We need to get the message's tokens to see if it has a message or not.
			const user = msg.user,
				is_bits = doesRewardCostBits(msg.ffz_reward),
				tokens = msg.ffz_tokens = msg.ffz_tokens || line.chat.tokenizeMessage(msg, current_user),
				has_message = tokens.length > 0;

			// Elements for the reward and cost with nice formatting.
			const reward = e('span', {className: 'ffz--points-reward'}, getRewardTitle(msg.ffz_reward, line.i18n)),
				cost = e('span', {className: 'ffz--points-cost'}, [
					e('span', {className: is_bits ? 'ffz-i-bits' : 'ffz--points-icon'}),
					line.i18n.formatNumber(getRewardCost(msg.ffz_reward))
				]);

			if (! has_message)
				return line.i18n.tList('chat.points.user-redeemed', '{user} redeemed {reward} {cost}', {
					reward, cost,
					user: e('span', {
						role: 'button',
						className: 'chatter-name',
						onClick: inst.ffz_user_click_handler,
						onContextMenu: line.actions.handleUserContext
					}, e('span', {
						className: 'tw-c-text-base tw-strong'
					}, user.displayName))
				});

			return line.i18n.tList('chat.points.redeemed', 'Redeemed {reward} {cost}', {reward, cost});
		}
	};

	line.line_types.resub = {
		getClass: () => `ffz--subscribe-line tw-pd-r-2`,

		renderNotice: (msg, current_user, room, inst, e) => {
			const months = msg.sub_cumulative || msg.sub_months,
				setting = line.chat.context.get('chat.subs.show');

			let has_message;
			if (setting === 1 && months > 1) {
				const tokens = msg.ffz_tokens = msg.ffz_tokens || line.chat.tokenizeMessage(msg, current_user);
				has_message = tokens.length > 0;
			}

			if ( !(setting === 3 || (setting === 1 && has_message && months > 1) || (setting === 2 && months > 1)) )
				return null;

			const user = msg.user,
				plan = msg.sub_plan || {},
				tier = SUB_TIERS[plan.plan] || 1,
				multi = msg.sub_multi,

				has_multi = (multi?.count ?? 0) > 1 && multi.tenure === 0;

			const sub_msg = line.i18n.tList(
				`chat.sub.main${has_multi ? '-multi' : ''}`,
				`{user} subscribed {plan}${has_multi ? ' for {multi, plural, one {# month} other {# months}} in advance' : ''}. `,
				{
					user: e('span', {
						role: 'button',
						className: 'chatter-name',
						onClick: inst.ffz_user_click_handler,
						onContextMenu: line.actions.handleUserContext
					}, e('span', {
						className: 'tw-c-text-base tw-strong'
					}, user.displayName)),
					plan: plan.prime ?
						line.i18n.t('chat.sub.twitch-prime', 'with Prime Gaming') :
						line.i18n.t('chat.sub.plan', 'at Tier {tier}', {tier}),
					multi: has_multi
						? multi.count
						: 1
				}
			);

			if ( msg.sub_share_streak && msg.sub_streak > 1 ) {
				sub_msg.push(line.i18n.t(
					'chat.sub.cumulative-months',
					"They've subscribed for {cumulative,number} months, currently on a {streak,number} month streak!",
					{
						cumulative: msg.sub_cumulative,
						streak: msg.sub_streak
					}
				));

			} else if ( months > 1 ) {
				sub_msg.push(line.i18n.t(
					'chat.sub.months',
					"They've subscribed for {count,number} months!",
					{
						count: months
					}
				));
			}

			if ( ! line.chat.context.get('chat.subs.compact') )
				sub_msg.ffz_icon = e('span', {
					className: `ffz-i-${plan.prime ? 'crown' : 'star'} tw-mg-r-05`
				});

			return sub_msg;
		}
	};

	line.line_types.ritual = {
		getClass: () => `ffz--ritual-line tw-pd-r-2`,

		renderNotice: (msg, current_user, room, inst, e) => {
			const user = msg.user;

			if ( msg.ritual === 'new_chatter' ) {
				return line.i18n.tList('chat.ritual', '{user} is new here. Say hello!', {
					user: e('span', {
						role: 'button',
						className: 'chatter-name',
						onClick: inst.ffz_user_click_handler,
						onContextMenu: line.actions.handleUserContext
					}, e('span', {
						className: 'tw-c-text-base tw-strong'
					}, user.displayName))
				});
			}
		}
	};

	line.line_types.sub_gift = {
		getClass: () => 'ffz--subscribe-line',

		renderNotice: (msg, current_user, room, inst, e) => {
			const user = msg.user,

				plan = msg.sub_plan || {},
				months = msg.sub_months || 1,
				tier = SUB_TIERS[plan.plan] || 1;

			let sub_msg;

			const bits = {
				months,
				user: (msg.sub_anon || user.username === 'ananonymousgifter') ?
					line.i18n.t('chat.sub.anonymous-gifter', 'An anonymous gifter') :
					e('span', {
						role: 'button',
						className: 'chatter-name',
						onClick: inst.ffz_user_click_handler,
						onContextMenu: line.actions.handleUserContext
					}, e('span', {
						className: 'tw-c-text-base tw-strong'
					}, user.displayName)),
				plan: plan.plan === 'custom' ? '' :
					line.i18n.t('chat.sub.gift-plan', 'Tier {tier}', {tier}),
				recipient: e('span', {
					role: 'button',
					className: 'chatter-name',
					onClick: inst.ffz_user_click_handler,
					'data-user': JSON.stringify(msg.sub_recipient)
				}, e('span', {
					className: 'tw-c-text-base tw-strong'
				}, msg.sub_recipient.displayName))
			};

			if ( months <= 1 )
				sub_msg = line.i18n.tList('chat.sub.mystery', '{user} gifted a {plan} Sub to {recipient}! ', bits);
			else
				sub_msg = line.i18n.tList('chat.sub.gift-months', '{user} gifted {months, plural, one {# month} other {# months}} of {plan} Sub to {recipient}!', bits);

			if ( msg.sub_total === 1 )
				sub_msg.push(line.i18n.t('chat.sub.gift-first', "It's their first time gifting a Sub in the channel!"));
			else if ( msg.sub_total > 1 )
				sub_msg.push(line.i18n.t('chat.sub.gift-total', "They've gifted {count,number} Subs in the channel!", {
					count: msg.sub_total
				}));

			if ( ! line.chat.context.get('chat.subs.compact') )
				sub_msg.ffz_icon = e('span', {
					className: `ffz-i-${plan.prime ? 'crown' : 'star'} tw-mg-r-05`
				});

			return sub_msg;
		}
	}

	line.line_types.sub_mystery = {

		getClass: () => 'ffz--subscribe-line',

		renderNotice: (msg, user, room, inst, e, source) => {
			const mystery = msg.mystery;
			if ( mystery )
				mystery.line = inst;

			const sub_msg = line.i18n.tList('chat.sub.gift', "{user} is gifting {count, plural, one {# Tier {tier} Sub} other {# Tier {tier} Subs}} to {channel}'s community! ", {
				user: (msg.sub_anon || msg.user.username === 'ananonymousgifter') ?
					line.i18n.t('chat.sub.anonymous-gifter', 'An anonymous gifter') :
					e('span', {
						role: 'button',
						className: 'chatter-name',
						onClick: inst.ffz_user_click_handler,
						onContextMenu: line.actions.handleUserContext
					}, e('span', {
						className: 'tw-c-text-base tw-strong'
					}, msg.user.displayName)),
				count: msg.sub_count,
				tier: SUB_TIERS[msg.sub_plan] || 1,
				channel: source?.displayName || source?.login || msg.roomLogin
			});

			if ( msg.sub_total === 1 )
				sub_msg.push(line.i18n.t('chat.sub.gift-first', "It's their first time gifting a Sub in the channel!"));
			else if ( msg.sub_total > 1 )
				sub_msg.push(line.i18n.t('chat.sub.gift-total', "They've gifted {count} Subs in the channel!", {
					count: msg.sub_total
				}));

			if ( ! inst.ffz_click_expand )
				inst.ffz_click_expand = () => {
					inst.setState({
						ffz_expanded: ! inst.state.ffz_expanded
					});
				}

			const expanded = line.chat.context.get('chat.subs.merge-gifts-visibility') ?
				! inst.state.ffz_expanded : inst.state.ffz_expanded;

			let sub_list = null;
			if( expanded && mystery && mystery.recipients && mystery.recipients.length > 0 ) {
				const the_list = [];
				for(const x of mystery.recipients) {
					if ( the_list.length )
						the_list.push(', ');

					the_list.push(e('span', {
						role: 'button',
						className: 'ffz--giftee-name',
						onClick: inst.ffz_user_click_handler,
						'data-user': JSON.stringify(x)
					}, e('span', {
						className: 'tw-c-text-base tw-strong'
					}, x.displayName)));
				}

				sub_list = e('div', {
					className: 'tw-mg-t-05 tw-border-t tw-pd-t-05 tw-c-text-alt-2'
				}, the_list);
			}

			const target = [
				sub_msg
			];

			if ( mystery )
				target.push(e('span', {
					className: `tw-pd-l-05 ffz-font-size-4 ffz-i-${expanded ? 'down' : 'right'}-dir`
				}));

			const out = [
				e('div', {
					className: 'tw-full-width tw-c-text-alt-2',
					onClick: inst.ffz_click_expand
				}, target),
				sub_list
			];

			if ( ! line.chat.context.get('chat.subs.compact') )
				out.ffz_icon = e('span', {
					className: `ffz-i-star${msg.sub_anon ? '-empty' : ''} tw-mg-r-05`
				});

			out.ffz_target = target;
			return out;
		}
	};

	line.line_types.first_time_chatter = {
		getClass: () => {
			const style = line.chat.context.get('chat.lines.first-time-chatter');
			return `ffz--ftc-line ffz-custom-color${style === 1 ? ' ffz--ftc-bg' : ''}`;
		},

		renderNotice: (msg, current_user, room, inst, e) => {
			const notice = [
				e('span', { className: 'tw-c-text-base tw-strong' },
					line.i18n.t('chat.ftc-message', 'First Time Chatter')
				)
			];

			notice.ffz_icon = e('span', {
				className: 'ffz-i-first-time-chatter tw-c-text-base tw-mg-r-05'
			});

			return notice;
		}
	};

	line.line_types.announcement = {
		getClass: (msg) => {
			const color = msg.announcement_color?.toLowerCase();
			return `ffz--announcement-line ffz--announcement-${color}`;
		},

		renderNotice: (msg, current_user, room, inst, e) => {
			const target = [
				e('span', { className: 'ffz-i-shoutout tw-mg-r-05' }),
				line.i18n.t('chat.announcement', 'Announcement')
			];

			const out = [e('div', { className: 'tw-c-text-base tw-strong' }, target)];
			out.ffz_target = target;
			return out;
		}
	};

	line.line_types.watch_streak = {
		getClass: () => 'ffz--watch-streak-line',

		renderNotice: (msg, current_user, room, inst, e) => {
			const user = msg.user;
			const streak = msg.watch_streak;
			const copo = msg.copo_reward;

			const target = line.i18n.tList(
				'chat.watch-streak.header',
				'{icon}Watch Streak Reached {points_icon}+{copo}',
				{
					icon: e('span', { className: 'ffz-i-watch-streak tw-mg-r-05' }),
					points_icon: e('span', { className: 'ffz--points-icon' }),
					copo
				}
			);

			const header = e('div', {
				className: 'tw-c-text-base tw-strong'
			}, target);

			const body = e('div', {
				className: 'tw-c-text-alt-2'
			}, line.i18n.tList(
				'chat.watch-streak.body',
				'{user} is currently on a {streak,number}-stream streak!',
				{
					streak,
					user: e('span', {
						role: 'button',
						className: 'chatter-name',
						onClick: inst.ffz_user_click_handler
					}, e('span', {
						className: 'tw-c-text-base tw-strong'
					}, user.displayName))
				}
			));

			const out = [header, body];
			out.ffz_target = target;
			return out;
		}
	};

	line.line_types.raid_notice = {
		getClass: () => 'ffz--raid-line',

		renderNotice: (msg, current_user, room, inst, e) => {
			const user = msg.user;
			const count = msg.raid_viewer_count;

			const target = line.i18n.tList(
				'chat.raid.notice',
				'{user} is raiding with a party of {count}.',
				{
					user: e('span', {
						role: 'button',
						className: 'chatter-name',
						onClick: inst.ffz_user_click_handler
					}, e('span', {
						className: 'tw-c-text-base tw-strong'
					}, user.displayName)),
					count: e('strong', {}, line.i18n.formatNumber(count))
				}
			);

			const out = [e('div', { className: 'tw-c-text-base' }, target)];
			out.ffz_target = target;
			return out;
		}
	};

	line.line_types.shoutout = {
		getClass: () => 'ffz--shoutout-line',

		renderNotice: (msg, current_user, room, inst, e) => {
			const login = msg.shoutout_login;
			const display = msg.shoutout_display;

			const target_user = JSON.stringify({
				id: null,
				login,
				displayName: display
			});

			const target = [
				e('span', { className: 'ffz-i-shoutout tw-mg-r-05' }),
				line.i18n.t('chat.shoutout', 'Shoutout!')
			];

			const header = e('div', {
				className: 'tw-c-text-base tw-strong'
			}, target);

			const body = e('div', {}, line.i18n.tList(
				'chat.shoutout.body',
				'Was given to {user}',
				{
					user: e('span', {
						role: 'button',
						className: 'chatter-name',
						'data-user': target_user,
						onClick: inst.ffz_user_click_handler
					}, e('span', {
						className: 'tw-c-text-base tw-strong'
					}, display))
				}
			));

			const out = [header, body];
			out.ffz_target = target;
			return out;
		}
	};

}
