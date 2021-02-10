'use strict';

import {deep_copy} from 'utilities/object';

export default {
	data() {
		return {
			value: undefined,
			has_value: false,

			_unseen: false
		}
	},

	created() {
		const provider = this.context.provider,
			setting = this.item.setting;

		provider.on('changed', this._providerChange, this);

		this.has_value = provider.has(setting);
		if ( this.has_value )
			this.value = deep_copy(provider.get(setting));
		else
			this.value = this.default_value;

		if ( this.item.unseen ) {
			this._unseen = true;
			this.item.unseen = 0;
		}
	},

	destroyed() {
		const provider = this.context.provider;

		provider.off('changed', this._providerChange, this);

		this.value = undefined;
		this.has_value = false;
	},

	computed: {
		data() {
			const data = this.item.data;
			if ( typeof data === 'function' )
				return data(this.value);

			return data;
		},

		unseen() {
			return this._unseen || this.item.unseen > 0;
		},

		default_value() {
			if ( typeof this.item.default === 'function' )
				return this.item.default(this.context);

			return deep_copy(this.item.default);
		},

		isDefault() {
			return ! this.has_value
		}
	},

	methods: {
		_providerChange(key, val, deleted) {
			if ( key !== this.item.setting )
				return;

			if ( deleted ) {
				this.has_value = false;
				this.value = this.default_value;
			} else {
				this.has_value = true;
				this.value = deep_copy(val);
			}
		},

		set(value) {
			if ( this.item.process )
				value = this.item.process(value);

			const provider = this.context.provider,
				setting = this.item.setting;

			provider.set(setting, value);
			this.has_value = true;
			this.value = deep_copy(value);

			if ( this.item.onUIChange )
				this.item.onUIChange(this.value, this);
		},

		clear() {
			const provider = this.context.provider,
				setting = this.item.setting;

			provider.delete(setting);
			this.value = this.default_value;
			this.has_value = false;

			if ( this.item.onUIChange )
				this.item.onUIChange(this.value, this);
		}
	}
}