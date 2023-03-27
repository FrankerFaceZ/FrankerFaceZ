<template>
	<section class="viewer-card__actions tw-bottom-0 tw-pd-1">
		<template v-if="loading">
			<div class="tw-align-center tw-pd-1">
				<h1 class="tw-mg-5 ffz-i-zreknarf loading" />
			</div>
		</template>
		<template v-else-if="errorNoUser">
			<div class="tw-align-center tw-pd-1">
				<div class="tw-mg-t-1 tw-mg-b-2">
					<img
						src="//cdn.frankerfacez.com/emoticon/26608/2"
						srcSet="//cdn.frankerfacez.com/emoticon/26608/2 1x, //cdn.frankerfacez.com/emoticon/26608/4 2x"
					>
				</div>
				{{ t('emote-card.report.no-user', 'Sorry, but you don\'t appear to have a FrankerFaceZ account or you aren\'t signed in. In order to submit a report, you need to have a FFZ account.') }}
			</div>
		</template>
		<template v-else-if="error">
			<div class="tw-align-center tw-pd-1">
				<div class="tw-mg-t-1 tw-mg-b-2">
					<img
						src="//cdn.frankerfacez.com/emoticon/26608/2"
						srcSet="//cdn.frankerfacez.com/emoticon/26608/2 1x, //cdn.frankerfacez.com/emoticon/26608/4 2x"
					>
				</div>
				{{ t('emote-card.report.error', 'There was an error submitting your report.') }}
			</div>
		</template>
		<template v-else-if="success">
			<div class="tw-align-center tw-pd-1">
				{{ t('emote-card.report.success', 'Your report was submitted successfully.') }}
			</div>
			<div class="tw-align-center">
				<button
					class="tw-button tw-mg-x-1"
					@click="$emit('close')"
				>
					<span class="tw-button__text">
						{{ t('emote-card.close', 'Close') }}
					</span>
				</button>
			</div>
		</template>
		<template v-else-if="category">
			<p class="tw-strong tw-mg-b-05">
				<t-list
					phrase="emote-card.report-details"
					default="You are reporting this emote for {reason}. Please enter any additional details below:"
				>
					<template #reason><code>{{ category.i18n ? t(category.i18n, category.title, category) : category.title }}</code></template>
				</t-list>
			</p>

			<textarea
				v-model="message"
				class="tw-full-width tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input"
				:placeholder="t('emote-card.report.placeholder', 'Enter a report message here.')"
			/>

			<div class="tw-mg-t-05 tw-align-center">
				<button
					:disabled="! canReport"
					class="tw-button tw-mg-x-1"
					:class="{'tw-button--disabled': ! canReport}"
					@click="submitReport"
				>
					<span class="tw-button__icon tw-button__icon--left">
						<figure class="ffz-i-flag" />
					</span>
					<span class="tw-button__text">
						{{ t('emote-card.report', 'Report Emote') }}
					</span>
				</button>
			</div>
		</template>
		<template v-else>
			<p class="tw-strong tw-mg-b-1">
				{{ t('emote-card.report-why', 'Why are you submitting this report?') }}
			</p>

			<form class="tw-flex tw-flex-column tw-border tw-c-background-body tw-border-radius-small tw-full-width">
				<div
					v-for="(reason, idx) in REASONS"
					:key="idx"
					class="ffz-radio tw-relative tw-pd-l-1"
					:class="{'tw-border-t': idx > 0}"
				>
					<input
						:id="'report$' + id + '$reason$' + idx"
						:name="'report-reasons$' + id"
						v-model="pendingCategory"
						:value="reason"
						type="radio"
						class="ffz-radio__input"
					/>
					<label
						:for="'report$' + id + '$reason$' + idx"
						class="tw-block ffz-radio__label tw-pd-r-1 tw-pd-y-1"
					>
						<div class="tw-pd-l-1">
							{{ reason.i18n ? t(reason.i18n, reason.title, reason) : reason.title }}
						</div>
					</label>
				</div>
			</form>

			<div class="tw-mg-t-05 tw-align-center">
				<button
					:disabled="pendingCategory == null"
					class="tw-button tw-mg-x-1"
					:class="{'tw-button--disabled': pendingCategory == null}"
					@click="category = pendingCategory"
				>
					<span class="tw-button__text">
						{{ t('emote-card.report.next', 'Next') }}
					</span>
				</button>
			</div>

		</template>
	</section>
</template>

<script>

const REASONS = [
	{
		title: 'Bullying or Harassment',
		i18n: 'emote-card.report.bully-harass'
	},
	{
		title: 'Hateful Conduct',
		i18n: 'emote-card.report.hateful'
	},
	{
		title: 'Nudity or Sexually Explicit',
		i18n: 'emote-card.report.explicit'
	},
	{
		title: 'Other',
		i18n: 'emote-card.report.other',
		skip_report: true
	}
];

let id = 0;

export default {

	props: [
		'emote',
		'getFFZ'
	],

	data() {
		return {
			REASONS: REASONS,
			id: id++,
			message: '',
			pendingCategory: null,
			category: null,
			loading: false,
			success: false,
			error: false,
			errorNoUser: false
		}
	},

	computed: {
		canReport() {
			if ( ! this.category )
				return false;

			if ( this.category.skip_report )
				return ! /^\s*$/.test(this.message)

			return true;
		}
	},

	created() {
		this.checkToken();
	},

	methods: {
		async checkToken() {
			this.loading = true;
			let token;
			try {
				token = await this.getFFZ().resolve('socket').getAPIToken();
			} catch(err) {
				console.error(err);
				token = null;
			}

			this.loading = false;
			this.errorNoUser = token == null;
		},

		async submitReport() {
			if ( this.loading || ! this.canReport )
				return;

			this.loading = true;

			try {
				await this._submitReport();
			} catch(err) {
				console.error(err);
				this.loading = false;
				this.error = true;
				this.success = false;
				return;
			}

			this.loading = false;
			this.success = true;
		},

		async _submitReport() {
			const token = await this.getFFZ().resolve('socket').getAPIToken();
			if ( ! token?.token )
				throw new Error('Unable to get token');

			const server = this.getFFZ().resolve('staging').api;

			const params = new URLSearchParams;

			let msg = this.message;

			if ( this.category && ! this.category.skip_report )
				msg = `${this.category.title}${msg.length ? `\r\nDetails: ${msg}` : ''}`;

			params.append('report', msg);

			const resp = await fetch(`${server}/v2/emote/${this.emote.id}/report`, {
				method: 'POST',
				body: params,
				headers: {
					Authorization: `Bearer ${token.token}`
				}
			});

			if ( ! resp || ! resp.ok )
				throw new Error('Invalid response from server.');

			const data = await resp.json();

			if ( ! data?.success )
				throw new Error('Did not succeed');
		}
	}

}

</script>