'use strict';

import {deep_copy} from 'utilities/object';

export default {
	data() {
		return {
			value: undefined,
			has_value: false,
			profile: null,

			_unseen: false,
			source: null,
			source_value: undefined,
		}
	},

	created() {
		const ctx = this.context.context,
			setting = this.item.setting;

		ctx._add_user();

		this._update_profile();
		this._uses_changed(ctx.uses(setting));

		if ( this.item.unseen ) {
			this._unseen = true;
			this.item.unseen = 0;
		}

		ctx.on(`uses_changed:${setting}`, this._uses_changed, this);
	},

	destroyed() {
		const ctx = this.context.context,
			setting = this.item.setting;

		if ( this.profile )
			this.profile.off('changed', this._setting_changed, this);

		if ( this.source )
			this.source.off('changed', this._source_setting_changed, this);

		ctx.off(`uses_changed:${setting}`, this._uses_changed, this);

		this.value = undefined;
		this.has_value = false;
		this.profile = null;

		this.source_value = undefined;
		this.source = null;

		ctx._remove_user();
	},

	watch: {
		'context.currentProfile'() {
			this._update_profile();
		}
	},

	computed: {
		data() {
			const data = this.item.data;
			if ( typeof data === 'function' )
				return data(this.profile, this.value);

			return data;
		},

		unseen() {
			return this._unseen || this.item.unseen > 0
		},

		default_value() {
			if ( typeof this.item.default === 'function' )
				return this.item.default(this.context.context);

			return deep_copy(this.item.default);
		},

		isInherited() {
			return ! this.has_value && this.source && this.sourceOrder > this.profileOrder;
		},

		isDefault() {
			return ! this.has_value && ! this.source
		},

		isOverridden() {
			return this.source && this.sourceOrder < this.profileOrder;
		},

		sourceOrder() {
			return this.source ? this.source.order : Infinity
		},

		profileOrder() {
			return this.profile ? this.profile.order : Infinity
		},

		sourceTitle() {
			if ( this.source )
				return this.source.i18n_key ?
					this.t(this.source.i18n_key, this.source.title, this.source) :
					this.source.title;
		},

		sourceDisplay() {
			const opts = {
				title: this.sourceTitle
			};

			if ( this.isInherited )
				return this.t('setting.inherited-from', 'Inherited From: {title}', opts);
			else if ( this.isOverridden )
				return this.t('setting.overridden-by', 'Overridden By: {title}', opts);
		}
	},

	methods: {
		_update_profile() {
			if ( this.profile )
				this.profile.off('changed', this._setting_changed, this);

			const profile = this.profile = this.context.currentProfile,
				setting = this.item.setting;

			profile.on('changed', this._setting_changed, this);

			this.has_value = profile.has(setting);
			this.value = this.has_value ?
				deep_copy(profile.get(setting)) :
				this.isInherited ?
					this.source_value :
					this.default_value;
		},

		_setting_changed(key, value, deleted) {
			if ( key !== this.item.setting )
				return;

			this.has_value = deleted !== true;
			this.value = this.has_value ?
				deep_copy(value) :
				this.isInherited ?
					this.source_value :
					this.default_value;
		},

		_source_setting_changed(key, value, deleted) {
			if ( key !== this.item.setting )
				return;

			this.source_value = deep_copy(value);
			if ( this.isInherited )
				this.value = deleted ? this.default_value : value;
		},

		_uses_changed(uses) {
			if ( this.source )
				this.source.off('changed', this._source_setting_changed, this);

			// We primarily only care about the main source.
			uses = uses ? uses[0] : null;

			const source = this.source = this.context.profile_keys[uses],
				setting = this.item.setting;

			if ( source ) {
				source.on('changed', this._source_setting_changed, this);
				this.source_value = deep_copy(source.get(setting));

			} else
				this.source_value = undefined;

			if ( ! this.has_value )
				this.value = this.isInherited ? this.source_value : this.default_value;
		},

		set(value) {
			if ( this.item.process )
				value = this.item.process(value);

			this.profile.set(this.item.setting, value);
		},

		clear() {
			this.profile.delete(this.item.setting);
		}
	}
}