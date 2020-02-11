<template lang="html">
	<div>
		<div v-if="! page" class="tw-flex tw-flex-wrap">
			<div
				v-for="info in info_blocks"
				:key="info.key"
				class="tw-flex tw-flex-column tw-justify-content-center tw-pd-x-1 tw-pd-y-05 tw-c-background-base tw-border-radius-large tw-mg-r-1 tw-mg-b-1"
			>
				<p class="tw-c-text-base tw-font-size-4">
					{{ get(info.key, info.format) }}
				</p>
				<p class="tw-c-text-alt-2 tw-font-size-6">
					{{ info.i18n_key ? t(info.i18n_key, info.title) : info.title }}
				</p>
			</div>
		</div>
		<div v-if="! page" class="tw-border-t tw-pd-t-1 tw-flex tw-flex-wrap">
			<div
				v-for="info in stat_blocks"
				:key="info.key"
				:class="info.click ? 'ffz--cursor' : ''"
				class="tw-flex tw-flex-column tw-justify-content-center tw-pd-x-1 tw-pd-y-05 tw-c-background-base tw-border-radius-large tw-mg-r-1 tw-mg-b-1"
				@click="onClick(info, $event)"
			>
				<p class="tw-c-text-base tw-font-size-4">
					{{ get(info.key, info.format) }}
				</p>
				<p class="tw-c-text-alt-2 tw-font-size-6">
					{{ info.i18n_key ? t(info.i18n_key, info.title) : info.title }}
				</p>
			</div>
		</div>
		<button
			v-if="page"
			class="tw-mg-b-1 tw-button tw-button--text"
			@click="page = null"
		>
			<span class="tw-button__text">
				{{ t('settings.back', 'Back') }}
			</span>
		</button>
		<div v-if="page == 'versions'">
			<table>
				<thead class="tw-border-b tw-pd-b-05 tw-mg-b-05 tw-strong">
					<th class="tw-pd-r-1">{{ t('socket.info.version', 'Version') }}</th>
					<th>{{ t('socket.info.count', 'Count') }}</th>
				</thead>
				<tbody>
					<tr v-for="entry in version_list" :key="entry[0]">
						<td class="tw-pd-r-1">{{ entry[0] }}</td>
						<td>{{ tNumber(entry[1]) }}</td>
					</tr>
				</tbody>
			</table>
		</div>
		<div v-if="page == 'commands'">
			<table>
				<thead class="tw-border-b tw-pd-b-05 tw-mg-b-05 tw-strong">
					<th class="tw-pd-r-1">{{ t('socket.info.command', 'Command') }}</th>
					<th>{{ t('socket.info.count', 'Count') }}</th>
				</thead>
				<tbody>
					<tr v-for="entry in command_list" :key="entry[0]">
						<td class="tw-pd-r-1">{{ entry[0] }}</td>
						<td>{{ tNumber(entry[1]) }}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script>

import {get} from 'utilities/object';

const INFO_BLOCKS = [
	{
		key: 'state',
		title: 'State'
	},
	{
		key: 'server',
		title: 'Server'
	},
	{
		key: 'stats.authenticated',
		title: 'Authenticated'
	},
	{
		key: 'topics',
		title: 'Topics'
	},
	{
		key: 'ping',
		title: 'Ping',
		format(val) {
			if ( val == null )
				return null;

			return `${Math.round(val)} ms`;
		}
	},
	{
		key: 'time_offset',
		title: 'Time Offset',
		format(val) {
			if ( val == null )
				return null;

			return `${Math.round(val)} ms`;
		}
	},
	{
		key: 'local_time',
		title: 'Local Time',
		format(val) {
			if ( val == null )
				return null;

			return val.toISOString();
		}
	},
	{
		key: 'server_time',
		title: 'Server Time',
		format(val) {
			if ( val == null )
				return null;

			return val.toISOString();
		}
	}
];

function formatNumber(val) {
	return val == null ? null : this.tNumber(val); // eslint-disable-line no-invalid-this
}

const STAT_BLOCKS = [
	{
		key: 'stats.connected_clients',
		title: 'Connected Clients',
		format: formatNumber
	},
	{
		key: 'stats.live_clients',
		title: 'Live Clients',
		format: formatNumber
	},
	{
		key: 'stats.total_commands',
		title: 'Commands',
		click() {
			this.page = 'commands';
		},
		format: formatNumber
	},
	{
		key: 'stats.total_messages',
		title: 'Messages',
		format: formatNumber
	},
	{
		key: 'stats.versions',
		title: 'Client Versions',
		click() {
			this.page = 'versions';
		},
		format(val) {
			if ( val == null )
				return null;

			return Object.keys(val).length;
		}
	}
];

export default {
	props: ['item', 'context'],

	data() {
		return {
			connected: false,
			connecting: false,
			server: null,
			ping: null,
			local_time: new Date(),
			time_offset: null,
			stats: null,
			topics: null,
			page: null
		}
	},

	computed: {
		info_blocks() {
			const out = [];
			for(const info of INFO_BLOCKS) {
				const copy = Object.assign({}, info);
				if ( ! copy.i18n_key )
					copy.i18n_key = `socket.info.${copy.key}`;

				out.push(copy);
			}

			return out;
		},

		stat_blocks() {
			const out = [];
			for(const info of STAT_BLOCKS) {
				const copy = Object.assign({}, info);
				if ( ! copy.i18n_key )
					copy.i18n_key = `socket.info.${copy.key}`;

				out.push(copy);
			}

			return out;
		},

		version_list() {
			if ( ! this.stats?.versions )
				return [];

			const out = Object.entries(this.stats.versions);
			out.sort((a,b) => b[1] - a[1]);
			return out;
		},

		command_list() {
			if ( ! this.stats?.commands )
				return [];

			const out = Object.entries(this.stats.commands);
			out.sort((a,b) => b[1] - a[1]);
			return out;
		},

		state() {
			if ( this.connected )
				return this.t('socket.info.connected', 'connected');
			else if ( this.connecting )
				return this.t('socket.info.connecting', 'connecting');

			return this.t('socket.info.disconnected', 'disconnected');
		},

		server_time() {
			if ( this.time_offset == null || this.local_time == null )
				return null;

			return new Date(this.local_time.getTime() - this.time_offset);
		}
	},

	created() {
		this.time_interval = setInterval(this.updateTime.bind(this), 1000);
		this.info_interval = setInterval(this.updateInfo.bind(this), 5000);

		this.updateInfo();
		this.update();

		const socket = this.item.getSocket();

		socket.on(':pong', this.update, this);
		socket.on(':sub-change', this.update, this);
		socket.on(':connected', this.update, this);
		socket.on(':closed', this.update, this);
		socket.on(':disconnected', this.update, this);
	},

	destroyed() {
		clearInterval(this.time_interval);
		clearInterval(this.info_interval);

		this.time_interval = null;
		this.info_interval = null;

		const socket = this.item.getSocket();

		socket.off(':pong', this.update, this);
		socket.off(':sub-change', this.update, this);
		socket.off(':connected', this.update, this);
		socket.off(':closed', this.update, this);
		socket.off(':disconnected', this.update, this);
	},

	methods: {
		onClick(info, e) {
			if ( info.click )
				info.click.call(this, e);
		},

		get(key, fmt) {
			let val = get(key, this);
			if ( fmt )
				val = fmt.call(this, val);

			if ( val == null )
				return '---';

			return val;
		},

		updateTime() {
			const socket = this.item.getSocket();
			socket.ping(true);

			this.local_time = new Date();
		},

		async updateInfo() {
			if ( this.updating_info )
				return;

			this.updating_info = true;

			const socket = this.item.getSocket();
			this.stats = socket.connected ? (await socket.call('get_server_status')) : null;
			this.updating_info = false;
		},

		update() {
			const socket = this.item.getSocket();

			this.connected = socket.connected;
			this.connecting = socket.connecting;
			this.server = socket._host;
			this.ping = this.connected ? socket._last_ping : null;
			this.time_offset = this.connected ? socket._time_drift : null;
			this.topics = socket.topics?.length ?? 0;
		}
	}

}

</script>