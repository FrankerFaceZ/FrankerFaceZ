'use strict';

// ============================================================================
// Emote Modifiers and Effects
// Modifier flags, effect keyframes and the CSS behind them.
// ============================================================================

import {make_enum_flags} from 'utilities/object';

const Flags = make_enum_flags(
	'Hidden',
	'FlipX',
	'FlipY',
	'GrowX',
	'Slide',
	'Appear',
	'Leave',
	'Rotate',
	'Rotate90',
	'Greyscale',
	'Sepia',
	'Rainbow',
	'HyperRed',
	'Shake',
	'Cursed',
	'Jam',
	'Bounce',
	'NoSpace'
);

export const MODIFIER_FLAGS = Flags;

export const MODIFIER_KEYS = Object.values(MODIFIER_FLAGS).filter(x => typeof x === 'number');

const APPEAR_FRAMES = [
	[0, -18, 0, 0],
	[19.99, -18, 0, 0],
	[20, -18, 0.1, 0],
	[25, -16, 0.2, 0.6],
	[30, -14, 0.3, -4],
	[35, -12, 0.4, 0.6],
	[40, -10, 0.5, -4],
	[45, -8, 0.6, 2],
	[50, -6, 0.7, -3],
	[55, -4, 0.8, 2],
	[60, -2, 0.9, -3],
	[65, 0, 1, 0],
	[100, 0, 1, 0]
];

const LEAVE_FRAMES = [
	[0, 0, 1, 0],
	[39.99, 0, 1, 0],
	[40, 0, -.9, .9, -3],
	[45, -2, -.8, .8, 2],
	[50, -4, -.7, .7, -3],
	[55, -6, -.6, .6, 2],
	[60, -8, -.5, .5, -4],
	[65, -10, -.4, .4, .6],
	[70, -12, -.3, .3, -4],
	[75, -14, -.2, .2, .6],
	[80, -16, -.1, .1, 0],
	[85, -18, -0.01, 0, 0],
	[100, -18, 0, 0, 0]
];


function appearLeaveToKeyframes(source, multi = 1, offset = 0, has_var = false) {
	const out = [];

	for(const line of source) {
		const pct = (line[0] * multi) + offset;

		const vr = has_var ? `var(--ffz-effect-transforms) ` : '',
			tx = line[1] === 0 ? '' : `translateX(${line[1]}px) `;
		let scale, ty;

		if ( line.length === 4 ) {
			scale = `scale(${line[2]})`;
			ty = line[3] === 0 ? '' : ` translateY(${line[3]}px)`;

		} else {
			const sx = line[2],
				sy = line[3];

			scale = `scale(${sx}, ${sy})`;

			ty = line[4] === 0 ? '' : ` translateY(${line[4]}px)`;
		}

		out.push(`\t${pct}% { transform:${vr}${tx}${scale}${ty}; }`);
	}

	return out.join('\n');
}



export const EFFECT_STYLES = [
	{
		setting: 'FlipX',
		flags: Flags.FlipX,
		title: 'Flip Horizontal',
		transform: 'scaleX(-1)'
	},
	{
		setting: 'FlipY',
		flags: Flags.FlipY,
		title: 'Flip Vertical',
		transform: 'scaleY(-1)'
	},
	{
		setting: 'ShrinkX',
		flags: Flags.ShrinkX,
		title: 'Squish Horizontal'
	},
	{
		setting: 'GrowX',
		flags: Flags.GrowX,
		title: 'Stretch Horizontal'
	},
	{
		setting: 'Slide',
		flags: Flags.Slide,
		//not_flags: Flags.Rotate,
		title: 'Slide Animation',
		as_background: true,
		animation: 'ffz-effect-slide var(--ffz-speed-x) linear infinite',
		raw: `@keyframes ffz-effect-slide {
0% { background-position-x: 0; }
100% { background-position-x: calc(-1 * var(--ffz-width)); }
}`
	},
	{
		setting: 'Appear',
		flags: Flags.Appear,
		not_flags: Flags.Leave,
		title: 'Appear Animation',
		animation: 'ffz-effect-appear 3s infinite linear',
		animationTransform: 'ffz-effect-appear-transform 3s linear infinite',
		raw: `@keyframes ffz-effect-appear {
${appearLeaveToKeyframes(APPEAR_FRAMES)}
}
@keyframes ffz-effect-appear-transform {
${appearLeaveToKeyframes(APPEAR_FRAMES, 1, 0, true)}
}`
	},
	{
		setting: 'Leave',
		flags: Flags.Leave,
		not_flags: Flags.Appear,
		title: 'Leave Animation',
		animation: 'ffz-effect-leave 3s infinite linear',
		animationTransform: 'ffz-effect-leave-transform 3s infinite linear',
		raw: `@keyframes ffz-effect-leave {
${appearLeaveToKeyframes(LEAVE_FRAMES)}
}
@keyframes ffz-effect-leave-transform {
${appearLeaveToKeyframes(LEAVE_FRAMES, 1, 0, true)}
}`
	},
	{
		setting: [
			'Appear',
			'Leave'
		],
		flags: Flags.Appear | Flags.Leave,
		animation: 'ffz-effect-in-out 6s infinite linear',
		animationTransform: 'ffz-effect-in-out-transform 6s linear infinite',
		raw: `@keyframes ffz-effect-in-out {
${appearLeaveToKeyframes(APPEAR_FRAMES, 0.5, 0)}
${appearLeaveToKeyframes(LEAVE_FRAMES, 0.5, 50)}
}
@keyframes ffz-effect-in-out-transform {
${appearLeaveToKeyframes(APPEAR_FRAMES, 0.5, 0, true)}
${appearLeaveToKeyframes(LEAVE_FRAMES, 0.5, 50, true)}
}`
	},
	{
		setting: 'Rotate',
		flags: Flags.Rotate,
		not_flags: Flags.Slide,
		title: 'Rotate Animation',
		no_wide: true,
		animation: 'ffz-effect-rotate 1.5s infinite linear',
		animationTransform: 'ffz-effect-rotate-transform 1.5s infinite linear',
		raw: `@keyframes ffz-effect-rotate {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}
@keyframes ffz-effect-rotate-transform {
0% { transform: var(--ffz-effect-transforms) rotate(0deg); }
100% { transform: var(--ffz-effect-transforms) rotate(360deg); }
}`
	},
	/*{
		setting: [
			'Slide',
			'Rotate'
		],
		flags: Flags.Rotate | Flags.Slide,
		// Sync up the speed for slide and rotate if both are applied.
		animation: 'ffz-effect-slide calc(1.5 * var(--ffz-speed-x)) linear infinite'
	},
	{
		setting: 'Greyscale',
		flags: Flags.Greyscale,
		filter: 'grayscale(1)'
	},
	{
		setting: 'Sepia',
		flags: Flags.Sepia,
		filter: 'sepia(1)'
	},*/
	{
		setting: 'Rainbow',
		flags: Flags.Rainbow,
		title: 'Rainbow Animation',
		animation: 'ffz-effect-rainbow 2s linear infinite',
		animationFilter: 'ffz-effect-rainbow-filter 2s linear infinite',
		raw: `@keyframes ffz-effect-rainbow {
	0% { filter: hue-rotate(0deg) }
	100% { filter: hue-rotate(360deg) }
}
@keyframes ffz-effect-rainbow-filter {
	0% { filter: var(--ffz-effect-filters) hue-rotate(0deg) }
	100% { filter: var(--ffz-effect-filters) hue-rotate(360deg) }
}`
	},
	{
		setting: 'HyperRed',
		flags: Flags.HyperRed,
		title: 'Hyper Red',
		filter: 'brightness(0.2) sepia(1) brightness(2.2) contrast(3) saturate(8)'
	},
	{
		setting: 'Shake',
		flags: Flags.Shake,
		title: 'Hyper Shake Animation',
		animation: 'ffz-effect-shake 0.1s linear infinite',
		animationTransform: 'ffz-effect-shake-transform 0.1s linear infinite',
		raw: `@keyframes ffz-effect-shake-transform {
	0% { transform: var(--ffz-effect-transforms) translate(1px, 1px); }
	10% { transform: var(--ffz-effect-transforms) translate(-1px, -2px); }
	20% { transform: var(--ffz-effect-transforms) translate(-3px, 0px); }
	30% { transform: var(--ffz-effect-transforms) translate(3px, 2px); }
	40% { transform: var(--ffz-effect-transforms) translate(1px, -1px); }
	50% { transform: var(--ffz-effect-transforms) translate(-1px, 2px); }
	60% { transform: var(--ffz-effect-transforms) translate(-3px, 1px); }
	70% { transform: var(--ffz-effect-transforms) translate(3px, 1px); }
	80% { transform: var(--ffz-effect-transforms) translate(-1px, -1px); }
	90% { transform: var(--ffz-effect-transforms) translate(1px, 2px); }
	100% { transform: var(--ffz-effect-transforms) translate(1px, -2px); }
}
@keyframes ffz-effect-shake {
	0% { transform: translate(1px, 1px); }
	10% { transform: translate(-1px, -2px); }
	20% { transform: translate(-3px, 0px); }
	30% { transform: translate(3px, 2px); }
	40% { transform: translate(1px, -1px); }
	50% { transform: translate(-1px, 2px); }
	60% { transform: translate(-3px, 1px); }
	70% { transform: translate(3px, 1px); }
	80% { transform: translate(-1px, -1px); }
	90% { transform: translate(1px, 2px); }
	100% { transform: translate(1px, -2px); }
}`
	},
	{
		setting: 'Photocopy',
		flags: Flags.Cursed,
		title: 'Cursed',
		filter: 'grayscale(1) brightness(0.7) contrast(2.5)'
	},
	{
		setting: 'Jam',
		flags: Flags.Jam,
		title: 'Jam Animation',
		animation: 'ffz-effect-jam 0.6s linear infinite',
		animationTransform: 'ffz-effect-jam-transform 0.6s linear infinite',
		raw: `@keyframes ffz-effect-jam {
	0% { transform: translate(-2px, -2px) rotate(-6deg); }
	10% { transform: translate(-1.5px, -2px) rotate(-8deg); }
	20% { transform: translate(1px, -1.5px) rotate(-8deg); }
	30% { transform: translate(3px, 2.5px) rotate(-6deg); }
	40% { transform: translate(3px, 4px) rotate(-2deg); }
	50% { transform: translate(2px, 4px) rotate(3deg); }
	60% { transform: translate(1px, 4px) rotate(3deg); }
	70% { transform: translate(-0.5px, 3px) rotate(2deg); }
	80% { transform: translate(-1.25px, 1px) rotate(0deg); }
	90% { transform: translate(-1.75px, -0.5px) rotate(-2deg); }
	100% { transform: translate(-2px, -2px) rotate(-5deg); }
}
@keyframes ffz-effect-jam-transform {
	0% { transform: var(--ffz-effect-transforms) translate(-2px, -2px) rotate(-6deg); }
	10% { transform: var(--ffz-effect-transforms) translate(-1.5px, -2px) rotate(-8deg); }
	20% { transform: var(--ffz-effect-transforms) translate(1px, -1.5px) rotate(-8deg); }
	30% { transform: var(--ffz-effect-transforms) translate(3px, 2.5px) rotate(-6deg); }
	40% { transform: var(--ffz-effect-transforms) translate(3px, 4px) rotate(-2deg); }
	50% { transform: var(--ffz-effect-transforms) translate(2px, 4px) rotate(3deg); }
	60% { transform: var(--ffz-effect-transforms) translate(1px, 4px) rotate(3deg); }
	70% { transform: var(--ffz-effect-transforms) translate(-0.5px, 3px) rotate(2deg); }
	80% { transform: var(--ffz-effect-transforms) translate(-1.25px, 1px) rotate(0deg); }
	90% { transform: var(--ffz-effect-transforms) translate(-1.75px, -0.5px) rotate(-2deg); }
	100% { transform: var(--ffz-effect-transforms) translate(-2px, -2px) rotate(-5deg); }
}`
	},
	{
		setting: 'Bounce',
		flags: Flags.Bounce,
		animation: 'ffz-effect-bounce 0.5s linear infinite',
		animationTransform: 'ffz-effect-bounce-transform 0.5s linear infinite',
		transformOrigin: 'bottom center',
		raw: `@keyframes ffz-effect-bounce {
	0% { transform: scale(0.8, 1); }
	10% { transform: scale(0.9, 0.8); }
	20% { transform: scale(1, 0.4); }
	25% { transform: scale(1.2, 0.3); }
	25.001% { transform: scale(-1.2, 0.3); }
	30% { transform: scale(-1, 0.4); }
	40% { transform: scale(-0.9, 0.8); }
	50% { transform: scale(-0.8, 1); }
	60% { transform: scale(-0.9, 0.8); }
	70% { transform: scale(-1, 0.4); }
	75% { transform: scale(-1.2, 0.3); }
	75.001% { transform: scale(1.2, 0.3); }
	80% { transform: scale(1, 0.4); }
	90% { transform: scale(0.9, 0.8); }
	100% { transform: scale(0.8, 1); }
}
@keyframes ffz-effect-bounce-transform {
	0% { transform: scale(0.8, 1) var(--ffz-effect-transforms); }
	10% { transform: scale(0.9, 0.8) var(--ffz-effect-transforms); }
	20% { transform: scale(1, 0.4) var(--ffz-effect-transforms); }
	25% { transform: scale(1.2, 0.3) var(--ffz-effect-transforms); }
	25.001% { transform: scale(-1.2, 0.3) var(--ffz-effect-transforms); }
	30% { transform: scale(-1, 0.4) var(--ffz-effect-transforms); }
	40% { transform: scale(-0.9, 0.8) var(--ffz-effect-transforms); }
	50% { transform: scale(-0.8, 1) var(--ffz-effect-transforms); }
	60% { transform: scale(-0.9, 0.8) var(--ffz-effect-transforms); }
	70% { transform: scale(-1, 0.4) var(--ffz-effect-transforms); }
	75% { transform: scale(-1.2, 0.3) var(--ffz-effect-transforms); }
	75.001% { transform: scale(1.2, 0.3) var(--ffz-effect-transforms); }
	80% { transform: scale(1, 0.4) var(--ffz-effect-transforms); }
	90% { transform: scale(0.9, 0.8) var(--ffz-effect-transforms); }
	100% { transform: scale(0.8, 1) var(--ffz-effect-transforms); }
}`
	},
	{
		setting: [
			'Bounce',
			'FlipY'
		],
		flags: Flags.Bounce | Flags.FlipY,
		transform: 'translateY(100%)',
	},
];


export function generateBaseFilterCss() {
	const out = [
		`.modified-emote[data-effects] > .chat-line__message--emote {
	--ffz-effect-filters: none;
	--ffz-effect-transforms: initial;
	--ffz-effect-animations: initial;
}`
	];

	//for(const [key, val] of Object.entries(MODIFIER_FLAG_CSS)) {
	for(const val of EFFECT_STYLES) {
		if ( val.raw )
			out.push(val.raw);
	}

	return out.join('\n');
}


export const MODIFIERS = {
	59847: {
		modifier_offset: '0 15px 15px 0',
		modifier: true
	},

	70852: {
		modifier: true,
		modifier_offset: '0 5px 20px 0',
		extra_width: 5,
		shrink_to_fit: true
	},

	70854: {
		modifier: true,
		modifier_offset: '30px 0 0'
	},

	147049: {
		modifier: true,
		modifier_offset: '4px 1px 0 3px'
	},

	147011: {
		modifier: true,
		modifier_offset: '0'
	},

	70864: {
		modifier: true,
		modifier_offset: '0'
	},

	147038: {
		modifier: true,
		modifier_offset: '0'
	}
};

