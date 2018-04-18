'use strict';

export default {
	computed: {
		data() {
			const data = this.tab.data;
			if ( typeof data === 'function' )
				return data.call(this, this.user, this.room, this.currentUser);

			return data;
		}
	},

	methods: {
		close() {
			this.$emit('close');
		}
	}
}