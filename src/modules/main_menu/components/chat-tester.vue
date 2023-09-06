<template>
	<div class="ffz--chat-tester">
		<div v-if="context.exclusive" class="tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-b-2">
			<h3 class="ffz-i-attention">
				{{ t('debug.chat-tester.exclusive', "Hey! This won't work here!") }}
			</h3>
			<markdown :source="t('debug.chat-tester.exclusive-explain', 'This feature does not work when the FFZ Control Center is popped out. It needs to be used in a window where you can see chat.')" />
		</div>

		<div class="tw-flex tw-align-items-start">
			<label for="selector" class="tw-mg-y-05">
				{{ t('debug.chat-tester.message', 'Test Message') }}
			</label>

			<div class="tw-flex tw-flex-column tw-mg-05 tw-full-width">
				<select
					id="selector"
					ref="selector"
					class="tw-full-width tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-font-size-6 ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05"
					@change="onSelectChange"
				>
					<option :selected="is_custom" value="custom">
						{{ t('setting.combo-box.custom', 'Custom') }}
					</option>
					<option
						v-for="(sample, idx) in samples"
						:key="idx"
						:selected="sample.data === message && sample.topic === topic"
						:value="idx"
					>
						{{ sample.name }}
					</option>
				</select>
				<input
					ref="topic"
					class="tw-block tw-font-size-6 tw-full-width ffz-textarea ffz-mg-t-1p"
					@blur="updateMessage"
					@input="onMessageChange"
				/>
				<textarea
					ref="message"
					class="tw-block tw-font-size-6 tw-full-width ffz-textarea ffz-mg-t-1p tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium"
					rows="10"
					@blur="updateMessage"
					@input="onMessageChange"
				/>
			</div>
		</div>

		<div class="tw-mg-t-1 tw-flex tw-align-items-center">
			<div class="tw-flex-grow-1" />

			<div class="tw-pd-x-1 ffz-checkbox">
				<input
					id="replay_fix"
					ref="replay_fix"
					:checked="replay_fix"
					type="checkbox"
					class="ffz-checkbox__input"
					@change="onCheck"
				>

				<label for="replay_fix" class="ffz-checkbox__label">
					<span class="tw-mg-l-1">
						{{ t('debug.chat-tester.replay-fix', 'Fix ID and Channel') }}
					</span>
				</label>
			</div>

			<button
				class="tw-mg-l-1 tw-button tw-button--text"
				@click="playMessage"
			>
				<span class="tw-button__text ffz-i-play">
					{{ t('debug.chat-tester.play', 'Play Message') }}
				</span>
			</button>
		</div>

		<div class="tw-pd-t-1 tw-border-t tw-mg-t-1 tw-flex tw-mg-b-1 tw-align-items-center">
			<div class="tw-flex-grow-1" />

			<div class="tw-pd-x-1 ffz-checkbox">
				<input
					id="capture_chat"
					ref="capture_chat"
					:checked="capture_chat"
					type="checkbox"
					class="ffz-checkbox__input"
					@change="onCheck"
				>

				<label for="capture_chat" class="ffz-checkbox__label">
					<span class="tw-mg-l-1">
						{{ t('debug.chat-tester.capture-chat', 'Capture Chat') }}
					</span>
				</label>
			</div>

			<div class="tw-pd-x-1 ffz-checkbox">
				<input
					id="ignore_privmsg"
					ref="ignore_privmsg"
					:checked="ignore_privmsg"
					type="checkbox"
					class="ffz-checkbox__input"
					@change="onCheck"
				>

				<label for="ignore_privmsg" class="ffz-checkbox__label">
					<span class="tw-mg-l-1">
						{{ t('debug.chat-tester.ignore-privmsg', 'Ignore PRIVMSG') }}
					</span>
				</label>
			</div>

			<div class="tw-pd-x-1 ffz-checkbox">
				<input
					id="capture_pubsub"
					ref="capture_pubsub"
					:checked="capture_pubsub"
					type="checkbox"
					class="ffz-checkbox__input"
					@change="onCheck"
				>

				<label for="capture_pubsub" class="ffz-checkbox__label">
					<span class="tw-mg-l-1">
						{{ t('debug.chat-tester.capture-pubsub', 'Capture PubSub') }}
					</span>
				</label>
			</div>

			<button
				class="tw-mg-l-1 tw-button tw-button--text"
				@click="clearLog"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('debug.chat-tester.clear-log', 'Clear Log') }}
				</span>
			</button>
		</div>

		<div
			v-for="item in log"
			:key="item._id"
			class="tw-elevation-1 tw-border tw-pd-y-05 tw-pd-r-1 tw-mg-y-05 tw-flex tw-flex-nowrap tw-align-items-center"
			:class="{'tw-c-background-base': item.pubsub, 'tw-c-background-alt-2': !item.pubsub}"
		>
			<time class="tw-mg-l-05 tw-mg-r-1 tw-flex-shrink-0">
				{{ tTime(item.timestamp, 'HH:mm:ss') }}
			</time>
			<div v-if="item.pubsub" class="tw-flex-grow-1">
				<div class="tw-mg-b-05 tw-border-b tw-pd-b-05">{{ item.topic }}</div>
				<div v-html="highlightJson(item.data)" />
			</div>
			<div v-else-if="item.chat" class="tw-flex-grow-1">
				<div v-if="item.tags" class="ffz-ct--tags">
					@<template v-for="(tag, key) in item.tags"><span class="ffz-ct--tag">{{ key }}</span>=<span class="ffz-ct--tag-value">{{ tag }}</span>;</template>
				</div>
				<div class="ffz-ct--prefix">
					<template v-if="item.prefix">:<span v-if="item.user" class="ffz-ct--user">{{ item.user }}</span><span class="ffz-ct--prefix">{{ item.prefix }}</span></template>
					<span class="ffz-ct--command">{{ item.command }}</span>
					<template v-if="item.channel">#<span class="ffz-ct--channel">{{ item.channel }}</span></template>
				</div>
				<div v-if="item.last_param" class="ffz-ct--params">
					<span v-for="para in item.params" class="ffz-ct--param">{{ para }}</span>
					:<span class="ffz-ct--param">{{ item.last_param }}</span>
				</div>
			</div>
			<div v-else class="tw-flex-grow-1">
				{{ item.data }}
			</div>
			<div class="tw-mg-l-1 tw-flex tw-flex-wrap tw-flex-column tw-justify-content-start tw-align-items-start">
				<button
					v-if="item.chat || item.pubsub"
					class="tw-button tw-button--text"
					@click="replayItem(item)"
				>
					<span class="tw-button__text ffz-i-arrows-cw">
						{{ t('debug.chat-tester.replay', 'Replay') }}
					</span>
				</button>
				<button
					class="tw-button tw-button--text"
					@click="copyItem(item)"
				>
					<span class="tw-button__text ffz-i-docs">
						{{ t('setting.copy-json', 'Copy') }}
					</span>
				</button>
			</div>
		</div>
	</div>
</template>

<script>

import { sanitize } from 'src/utilities/dom';
import { DEBUG, SERVER } from 'utilities/constants';
import { deep_copy, generateUUID } from 'utilities/object';
import { getBuster } from 'utilities/time';

import SAMPLES from '../sample-chat-messages.json'; // eslint-disable-line no-unused-vars

const IGNORE_COMMANDS = [
	'PONG',
	'PING',
	'366',
	'353'
];

let LOADED_SAMPLES = [
	{
		"name": "Ping",
		"data": "PING :tmi.twitch.tv"
	}
];

let has_loaded_samples = false;

export default {
	props: ['item', 'context'],

	data() {
		const state = window.history.state;
		const samples = deep_copy(LOADED_SAMPLES);
		const message = state?.ffz_ct_message ?? samples[0].data;
		const topic = state?.ffz_ct_topic ?? samples[0].topic ?? '';

		let is_custom = true;
		/*for(const item of samples) {
			if ( ! item.topic )
				item.topic = '';
			if ( typeof item.data !== 'string' )
				item.data = JSON.stringify(item.data, null, 4);

			if (item.data === message && item.topic === topic) {
				is_custom = false;
				break;
			}
		}*/

		return {
			has_client: false,

			samples,
			is_custom,
			message,
			topic,

			replay_fix: state?.ffz_ct_replay ?? true,
			ignore_privmsg: state?.ffz_ct_privmsg ?? false,
			capture_chat: state?.ffz_ct_chat ?? false,
			capture_pubsub: state?.ffz_ct_pubsub ?? false,

			log: [],
			logi: 0
		}
	},

	watch: {
		message() {
			if ( ! this.is_custom )
				this.$refs.message.value = this.message;
		},

		topic() {
			if ( ! this.is_custom )
				this.$refs.topic.value = this.topic;
		},

		capture_chat() {
			if ( this.capture_chat )
				this.listenChat();
			else
				this.unlistenChat();
		},

		capture_pubsub() {
			if ( this.capture_pubsub )
				this.listenPubsub();
			else
				this.unlistenPubsub();
		}
	},

	created() {
		this.loadSamples();

		this.chat = this.item.getChat();

		this.client = this.chat.ChatService.first?.client;
		this.has_client = !!this.client;

		if ( this.capture_chat )
			this.listenChat();

		if ( this.capture_pubsub )
			this.listenPubsub();
	},

	beforeDestroy() {
		this.unlistenChat();
		this.unlistenPubsub();

		this.client = null;
		this.chat = null;
	},

	mounted() {
		this.$refs.message.value = this.message;
		this.$refs.topic.value = this.topic;
	},

	methods: {
		highlightJson(object, depth = 1) {
			if ( depth > 10 )
				return `<span class="ffz-ct--obj-literal">&lt;nested&gt;`;

			if (object == null)
				return `<span class="ffz-ct--literal" depth="${depth}">null</span>`;

			if ( typeof object === 'number' || typeof object === 'boolean' )
				return `<span class="ffz-ct--literal" depth="${depth}">${object}</span>`;

			if ( typeof object === 'string' )
				return `<span class=ffz-ct--string depth="${depth}">"${sanitize(object)}"</span>`;

			if ( Array.isArray(object) )
				return `<span class="ffz-ct--obj-open" depth="${depth}">[</span>`
					+ object.map(x => this.highlightJson(x, depth + 1)).join(`<span class="ffz-ct--obj-sep" depth="${depth}">, </span>`)
					+ `<span class="ffz-ct--obj-close" depth="${depth}">]</span>`;

			const out = [];

			for(const [key, val] of Object.entries(object)) {
				if ( out.length > 0 )
					out.push(`<span class="ffz-ct--obj-sep" depth="${depth}">, </span>`);

				out.push(`<span class="ffz-ct--obj-key" depth="${depth}">"${sanitize(key)}"</span><span class="ffz-ct--obj-key-sep" depth="${depth}">: </span>`);
				out.push(this.highlightJson(val, depth + 1));
			}

			return `<span class="ffz-ct--obj-open" depth="${depth}">{</span>${out.join('')}<span class="ffz-ct--obj-close" depth="${depth}">}</span>`;
		},

		// Samples
		async loadSamples() {
			if ( has_loaded_samples )
				return;

			const values = await fetch(DEBUG ? SAMPLES : `${SERVER}/script/sample-chat-messages.json?_=${getBuster()}`).then(r => r.ok ? r.json() : null);
			if ( Array.isArray(values) && values.length > 0 ) {
				has_loaded_samples = true;

				for(const item of values) {
					if ( ! item.topic )
						item.topic = '';
					if ( Array.isArray(item.data) )
						item.data = item.data.join('\n\n');
					else if ( typeof item.data !== 'string' )
						item.data = JSON.stringify(item.data, null, 4);
				}

				LOADED_SAMPLES = values;
				this.samples = deep_copy(values);

				let is_custom = true;
				for(const item of this.samples) {
					if (item.data === this.message && item.topic === this.topic) {
						is_custom = false;
						break;
					}
				}

				this.is_custom = is_custom;
			}
		},

		// Chat
		listenChat() {
			if ( this.listening_chat )
				return;

			// Ensure we have the chat client.
			if ( ! this.has_client ) {
				this.client = this.chat.ChatService.first?.client;
				this.has_client = !!this.client;

				if ( ! this.has_client )
					return;
			}

			// Hook into the connection.
			const conn = this.client.connection;

			if ( ! conn.ffzOnSocketMessage )
				conn.ffzOnSocketMessage = conn.onSocketMessage;

			conn.onSocketMessage = event => {
				try {
					this.handleChat(event);
				} catch(err) {
					/* no-op */
				}

				return conn.ffzOnSocketMessage(event);
			}

			if ( conn.ws )
				conn.ws.onmessage = conn.onSocketMessage;

			this.addLog("Started capturing chat.");

			this.listening_chat = true;
		},

		unlistenChat() {
			if ( ! this.listening_chat )
				return;

			const conn = this.client.connection;

			conn.onSocketMessage = conn.ffzOnSocketMessage;

			if ( conn.ws )
				conn.ws.onmessage = conn.onSocketMessage;

			this.addLog("Stopped capturing chat.");

			this.listening_chat = false;
		},

		handleChat(event) {
			for(const raw of event.data.split(/\r?\n/g)) {
				const msg = this.parseChat(raw);
				if ( msg ) {
					if ( this.ignore_privmsg && msg.command === 'PRIVMSG' )
						continue;

					if ( IGNORE_COMMANDS.includes(msg.command) )
						continue;

					this.addLog(msg);
				}
			}
		},

		parseChat(raw) {
			const msg = this.client.parser.msg(raw);
			msg.chat = true;

			if ( Object.keys(msg.tags).length === 0 )
				msg.tags = null;

			if ( msg.params.length > 0 && msg.params[0].startsWith('#') )
				msg.channel = msg.params.shift().slice(1);

			if ( msg.params.length > 0 )
				msg.last_param = msg.params.pop();

			const idx = msg.prefix ? msg.prefix.indexOf('!') : -1;

			if ( idx === -1 )
				msg.user = null;
			else {
				msg.user = msg.prefix.substr(0, idx);
				msg.prefix = msg.prefix.substr(idx);
			}

			return msg;
		},

		// Pubsub
		listenPubsub() {
			if ( this.listening_pubsub )
				return;

			this.chat.on('site.subpump:pubsub-message', this.handlePubsub, this);
			this.addLog("Started capturing PubSub.");

			this.listening_pubsub = true;
		},

		unlistenPubsub() {
			if ( ! this.listening_pubsub )
				return;

			this.chat.off('site.subpump:pubsub-message', this.handlePubsub, this);
			this.addLog("Stopped capturing PubSub.");

			this.listening_pubsub = false;
		},

		handlePubsub(event) {

			if ( event.prefix === 'video-playback-by-id' )
				return;

			this.addLog({
				pubsub: true,
				topic: event.topic,
				data: deep_copy(event.message)
			});
		},

		// State

		saveState() {
			try {
				window.history.replaceState({
					...window.history.state,
					ffz_ct_replay: this.replay_fix,
					ffz_ct_message: this.message,
					ffz_ct_chat: this.capture_chat,
					ffz_ct_pubsub: this.capture_pubsub,
					ffz_ct_privmsg: this.ignore_privmsg
				}, document.title);

			} catch(err) {
				/* no-op */
			}
		},

		// Event Handlers

		onSelectChange() {
			const idx = this.$refs.selector.value,
				item = this.samples[idx];

			if ( idx !== 'custom' && item?.data ) {
				this.message = item.data;
				this.topic = item.topic ?? '';
				this.is_custom = false;
			} else
				this.is_custom = true;
		},

		updateMessage() {
			const value = this.$refs.message.value,
				topic = this.$refs.topic.value;

			let is_custom = true;
			for(const item of this.samples) {
				if (item.data === value && item.topic === topic) {
					is_custom = false;
					break;
				}
			}

			this.is_custom = is_custom;
			if ( this.is_custom ) {
				this.topic = topic;
				this.message = value;
			}
		},

		onMessageChange() {
			this.updateMessage();
		},

		onCheck() {
			this.replay_fix = this.$refs.replay_fix.checked;
			this.capture_chat = this.$refs.capture_chat.checked;
			this.capture_pubsub = this.$refs.capture_pubsub.checked;
			this.ignore_privmsg = this.$refs.ignore_privmsg.checked;

			this.saveState();
		},

		// Log

		addLog(msg) {
			if ( typeof msg !== 'object' )
				msg = {
					data: msg
				};

			msg.timestamp = Date.now();
			msg._id = this.logi++;

			this.log.unshift(msg);
			const extra = this.log.length - 100;
			if ( extra > 0 )
				this.log.splice(100, extra);
		},

		clearLog() {
			this.log = [];
			this.addLog('Cleared log.');
		},

		// Item Actions

		copyItem(item) {
			let value;
			if ( item.raw )
				value = item.raw;
			else if ( item.data )
				value = item.data;
			else
				value = item;

			if ( typeof value !== 'string' )
				value = JSON.stringify(value);

			navigator.clipboard.writeText(value);
		},

		playMessage() {
			// Check for PubSub
			if ( this.topic.trim().length > 0 ) {
				let data;
				try {
					data = JSON.parse(this.message);
				} catch(err) {
					console.error(err);
					alert("Unable to parse message.");
					return;
				}

				this.replayItem({
					pubsub: true,
					topic: this.topic,
					data
				});

				return;
			}

			const msgs = [];
			const parts = this.message.split(/\r?\n/g);

			for(const part of parts) {
				try {
					if ( part && part.length > 0 )
						msgs.push(this.parseChat(part));

				} catch (err) {
					console.error(err);
					alert("Unable to parse message.");
					return;
				}
			}

			for(const msg of msgs)
				this.replayItem(msg);
		},

		replayItem(item) {
			if ( item.pubsub ) {
				const channel = this.chat.ChatService.first?.props?.channelID,
					user = this.chat.resolve('site').getUser();

				if ( this.replay_fix ) {
					item.topic = item.topic.replace(/<channel>/gi, channel);
					item.topic = item.topic.replace(/<user>/gi, user.id);
					// TODO: Crawl, replacing ids.
					// TODO: Update timestamps for pinned chat?
				}

				this.chat.resolve('site.subpump').inject(item.topic, item.data);
			}

			if ( item.chat ) {
				// While building the string, also build colors for the console log.
				const out = [];
				const colors = [];

				if ( item.tags ) {
					out.push('@');
					colors.push('gray');

					for(const [key, val] of Object.entries(item.tags)) {
						let v = val;

						// If the tag is "id", return a new id so the message
						// won't be deduplicated automatically.
						if ( key === 'id' && this.replay_fix )
							v = generateUUID();

						out.push(key);
						out.push('=');
						out.push(`${v}`);
						out.push(';');
						colors.push('orange');
						colors.push('gray');
						colors.push('white');
						colors.push('gray');
					}
				}

				if ( item.user || item.prefix ) {
					if ( out.length ) {
						out.push(' ');
						colors.push('');
					}

					out.push(':');
					colors.push('gray');
					if (item.user) {
						out.push(item.user);
						colors.push('green');
					}
					if (item.prefix) {
						out.push(item.prefix);
						colors.push('gray');
					}
				}

				if ( out.length ) {
					out.push(' ');
					colors.push('');
				}

				out.push(item.command);
				colors.push('orange');

				// If there's a channel, use the current channel rather
				// than the logged channel.
				if ( item.channel ) {
					out.push(` #`);
					colors.push('gray');
					out.push(this.replay_fix ? this.chat.ChatService.first?.props?.channelLogin ?? item.channel : item.channel);
					colors.push('green');
				}

				for(const para of item.params) {
					out.push(` ${para}`);
					colors.push('skyblue');
				}

				if ( item.last_param ) {
					out.push(` :`);
					colors.push('gray');
					out.push(item.last_param);
					colors.push('skyblue');
				}

				const msg = out.join(''),
					conn = this.client.connection,
					handler = conn.ffzOnSocketMessage ?? conn.onSocketMessage;

				const log_msg = out.join('%c'),
					log_colors = colors.map(x => x?.length ? `color: ${x};` : '');

				this.chat.log.debugColor(`Injecting chat message: %c${log_msg}`, log_colors);

				handler.call(conn, {
					data: msg
				});
			}

		}

	}

}

</script>