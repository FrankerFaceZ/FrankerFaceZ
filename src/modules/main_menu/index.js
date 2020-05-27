'use strict';

// ============================================================================
// Menu Module
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';
import {get, has, deep_copy} from 'utilities/object';

import Dialog from 'utilities/dialog';

import Mixin from './setting-mixin';

import {parse_path} from 'src/settings';

function format_term(term) {
	return term.replace(/<[^>]*>/g, '').toLocaleLowerCase();
}

// TODO: Rewrite literally everything about the menu to use a router and further
// separate the concept of navigation from visible pages.

export default class MainMenu extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');
		this.inject('site');
		this.inject('vue');

		this.load_requires = ['vue'];

		this.Mixin = Mixin;

		//this.should_enable = true;

		this.new_seen = false;

		this._settings_tree = null;
		this._settings_count = 0;

		this.dialog = new Dialog(() => this.buildDialog());
		this.has_update = false;
		this.opened = false;
		this.showing = false;

		this.settings.addUI('profiles', {
			path: 'Data Management @{"sort": 1000, "profile_warning": false} > Profiles @{"profile_warning": false}',
			component: 'profile-manager'
		});

		this.settings.addUI('backup', {
			path: 'Data Management > Backup and Restore @{"profile_warning": false}',
			component: 'backup-restore',
			getFFZ: () => this.resolve('core')
		});

		this.settings.addUI('home', {
			path: 'Home @{"sort": -1000, "profile_warning": false}',
			component: 'home-page'
		});

		this.settings.addUI('faq', {
			path: 'Home > FAQ @{"profile_warning": false}',
			component: 'md-page',
			key: 'faq'
		});

		/*this.settings.addUI('privacy', {
			path: 'Home > Privacy @{"profile_warning": false}',
			component: 'md-page',
			key: 'privacy',
			force_seen: true
		});*/

		this.settings.addUI('feedback', {
			path: 'Home > Feedback @{"profile_warning": false}',
			component: 'md-page',
			key: 'feedback'
		});

		this.settings.addUI('feedback.log', {
			path: 'Home > Feedback >> Log @{"sort": 1000}',
			component: 'async-text',
			watch: [
				'reports.error.include-user',
				'reports.error.include-settings'
			],
			data: () => this.resolve('core').generateLog()
		})

		this.settings.addUI('changelog', {
			path: 'Home > Changelog @{"profile_warning": false}',
			component: 'changelog'
		});

		this.settings.addUI('addon-changelog', {
			path: 'Add-Ons > Changelog @{"sort": -1000, "profile_warning": false}',
			component: 'changelog',
			force_seen: true,
			addons: true
		});

		this.settings.addUI('legal', {
			path: 'Home > Legal @{"sort": 1000}',
			component: 'md-page',
			key: 'legal',
			force_seen: true
		});

		this.on('settings:added-definition', (key, definition) => {
			this._addDefinitionToTree(key, definition);
			this.scheduleUpdate();
		})

		this.on('socket:command:new_version', version => {
			if ( version === window.FrankerFaceZ.version_info.commit )
				return;

			this.log.info('New Version:', version);
			this.has_update = true;

			const mb = this.resolve('site.menu_button');
			if ( mb )
				mb.has_update = true;

			if ( this._vue )
				this._vue.$children[0].context.has_update = true;
		});

		this.scheduleUpdate();
	}

	openPopout() {
		const win = window.open(
			'https://twitch.tv/popout/frankerfacez/chat?ffz-settings',
			'_blank',
			'resizable=yes,scrollbars=yes,width=850,height=600'
		);

		if ( win ) {
			win.focus();
			return true;
		} else {
			this.log.warn('Unable to open popout settings window.');
			return false;
		}
	}

	async onLoad() {
		this.vue.component(
			(await import(/* webpackChunkName: "main-menu" */ './components.js')).default
		);
	}


	async onEnable() {
		await this.site.awaitElement(Dialog.EXCLUSIVE);

		this.on('addons:added', this.scheduleUpdate, this);
		this.on('experiments:enabled', this.scheduleUpdate, this);
		this.on('i18n:update', this.scheduleUpdate, this);

		this.dialog.on('show', () => {
			this.showing = true;
			this.opened = true;
			this.updateButtonUnseen();
			this.emit('show')
		});
		this.dialog.on('hide', () => {
			this.showing = false;
			this.emit('hide');
			this.destroyDialog();
		});

		this.dialog.on('resize', () => {
			if ( this._vue )
				this._vue.$children[0].maximized = this.dialog.maximized
		});

		this.on('site.menu_button:clicked', this.dialog.toggleVisible, this.dialog);
		this.dialog.show();
	}

	onDisable() {
		this.dialog.hide();
		this.off('site.menu_button:clicked', this.dialog.toggleVisible, this.dialog);
	}


	requestPage(page) {
		const vue = get('_vue.$children.0', this);
		if ( vue && vue.navigate )
			vue.navigate(page);
		else
			this._wanted_page = page;
	}


	getUnseen() {
		const pages = this.getSettingsTree();
		if ( ! Array.isArray(pages) )
			return 0;

		let i=0;
		for(const page of pages)
			if ( page )
				i += (page.unseen || 0);

		return i;
	}


	buildDialog() {
		if ( this._menu )
			return this._menu;

		this._vue = new this.vue.Vue({
			el: createElement('div'),
			render: h => h('main-menu', this.getData())
		});

		return this._menu = this._vue.$el;
	}

	destroyDialog() {
		if ( this._vue )
			this._vue.$destroy();

		this._menu = this._vue = null;
	}


	scheduleUpdate() {
		if ( this._update_timer )
			return;

		this._update_timer = setTimeout(() => this.updateLiveMenu(), 250);
	}


	updateButtonUnseen() {
		const mb = this.resolve('site.menu_button');
		if ( mb )
			mb.new_settings = this.opened ? 0 : this.getUnseen();
	}


	updateLiveMenu() {
		clearTimeout(this._update_timer);
		this._update_timer = null;

		this.updateButtonUnseen();

		if ( ! this._vue || ! this._vue.$children || ! this._vue.$children[0] )
			return;

		const root = this._vue.$children[0],
			item = root.currentItem,
			key = item && item.full_key,

			tree = this.getSettingsTree();

		root.nav = tree;
		root.nav_keys = tree.keys;
		root.currentItem = tree.keys[key] || (this._wanted_page && tree.keys[this._wanted_page]) || (this.has_update ?
			tree.keys['home.changelog'] :
			tree.keys['home']);

		this._wanted_page = null;
	}


	rebuildSettingsTree() {
		this._settings_tree = {};
		this._settings_count = 0;

		for(const [key, def] of this.settings.definitions)
			this._addDefinitionToTree(key, def);

		for(const [key, def] of this.settings.ui_structures)
			this._addDefinitionToTree(key, def);
	}


	_addDefinitionToTree(key, def) {
		if ( ! def.ui || ! this._settings_tree )
			return;

		if ( ! def.ui.path_tokens ) {
			if ( def.ui.path )
				def.ui.path_tokens = parse_path(def.ui.path);
			else
				return;
		}

		if ( ! def.ui || ! def.ui.path_tokens || ! this._settings_tree )
			return;

		const tree = this._settings_tree,
			tokens = def.ui.path_tokens,
			len = tokens.length;

		let prefix = null,
			token;

		// Create and/or update all the necessary structure elements for
		// this node in the settings tree.
		for(let i=0; i < len; i++) {
			const raw_token = tokens[i],
				key = prefix ? `${prefix}.${raw_token.key}` : raw_token.key;

			token = tree[key];
			if ( ! token )
				token = tree[key] = {
					full_key: key,
					sort: 0,
					parent: prefix,
					expanded: prefix == null,
					i18n_key: `setting.${key}`,
					desc_i18n_key: `setting.${key}.description`
				};

			Object.assign(token, raw_token);

			prefix = key;
		}

		// Add this setting to the tree.
		token.settings = token.settings || [];
		token.settings.push([key, def]);
		this._settings_count++;
	}


	getSettingsTree() {
		const started = performance.now();

		if ( ! this._settings_tree )
			this.rebuildSettingsTree();

		const tree = this._settings_tree,
			settings_seen = this.new_seen ? null : this.settings.provider.get('cfg-seen'),
			new_seen = settings_seen ? null : [],

			collapsed = this.settings.provider.get('cfg-collapsed'),

			root = {},
			copies = {},

			needs_sort = new Set,
			needs_component = new Set,

			have_locale = this.i18n.locale !== 'en';

		if ( new_seen )
			this.new_seen = true;

		for(const key in tree) {
			if ( ! has(tree, key) )
				continue;

			const token = copies[key] = copies[key] || Object.assign({}, tree[key]),
				p_key = token.parent,
				parent = p_key ?
					(copies[p_key] = copies[p_key] || Object.assign({}, tree[p_key])) :
					root;

			token.parent = p_key ? parent : null;
			token.page = token.page || parent.page;

			if ( collapsed )
				token.expanded = ! collapsed.includes(token.full_key);

			if ( token.page && ! token.component )
				needs_component.add(token);

			if ( token.settings ) {
				const list = token.contents = token.contents || [];

				for(const [setting_key, def] of token.settings)
					if ( def.ui ) { //} && def.ui.title ) {
						const i18n_key = def.ui.i18n_key ? def.ui.i18n_key : setting_key ? `setting.entry.${setting_key}` : def.ui.key ? `${token.i18n_key}.${def.ui.key}` : token.i18n_key;
						const tok = Object.assign({
							i18n_key,
							desc_i18n_key: `${i18n_key}.description`,
							sort: 0,
							//title: setting_key
						}, def.ui, {
							full_key: `setting:${setting_key}`,
							setting: setting_key,
							path_tokens: undefined,
							parent: token
						});

						if ( has(def, 'default') && ! has(tok, 'default') ) {
							const def_type = typeof def.default;
							if ( def_type === 'object' )
								tok.default = deep_copy(def.default);
							else
								tok.default = def.default;
						}

						let terms = [
							setting_key
						];

						if ( tok.title ) {
							terms.push(this.i18n.t(tok.i18n_key, tok.title, null, true));

							if ( have_locale && this.i18n.has(tok.i18n_key) )
								terms.push(this.i18n.t(tok.i18n_key, tok.title, null));
						}

						if ( tok.description ) {
							terms.push(this.i18n.t(tok.desc_i18n_key, tok.description, null, true));

							if ( have_locale && this.i18n.has(tok.desc_i18n_key) )
								terms.push(this.i18n.t(tok.desc_i18n_key, tok.description, null));
						}

						if ( tok.getExtraTerms )
							terms = terms.concat(tok.getExtraTerms());

						tok.search_terms = terms.map(format_term).join('\n');

						if ( settings_seen ) {
							if ( ! settings_seen.includes(setting_key) && ! tok.force_seen ) {
								let i = tok;
								while(i) {
									i.unseen = (i.unseen || 0) + 1;
									i = i.parent;
								}
							}
						} else if ( new_seen )
							new_seen.push(setting_key);

						list.push(tok);
					}

				token.settings = undefined;
				if ( list.length > 1 )
					needs_sort.add(list);
			}

			if ( ! token.search_terms ) {
				const formatted = token.title && this.i18n.t(token.i18n_key, token.title, null, true);
				let terms = [token.key];

				if ( formatted && formatted.localeCompare(token.key, undefined, {sensitivity: 'base'}) )
					terms.push(formatted);

				if ( have_locale && this.i18n.has(token.i18n_key) )
					terms.push(this.i18n.t(token.i18n_key, token.title, null));

				if ( token.description ) {
					terms.push(this.i18n.t(token.desc_i18n_key, token.description, null, true));

					if ( have_locale && this.i18n.has(token.desc_i18n_key) )
						terms.push(this.i18n.t(token.desc_i18n_key, token.description, null));
				}

				terms = terms.map(format_term);

				for(const lk of ['tabs', 'contents', 'items'])
					if ( token[lk] )
						for(const tok of token[lk] )
							if ( tok.search_terms )
								terms.push(tok.search_terms);

				terms = token.search_terms = terms.join('\n');

				let p = parent;
				while(p && p.search_terms) {
					p.search_terms += `\n${terms}`;
					p = p.parent;
				}
			}

			const lk = token.tab ? 'tabs' : token.page ? 'contents' : 'items',
				list = parent[lk] = parent[lk] || [];

			list.push(token);
			if ( list.length > 1 )
				needs_sort.add(list);
		}

		for(const token of needs_component) {
			token.component = token.tabs ? 'tab-container' :
				token.contents ? 'menu-container' :
					'setting-check-box';
		}

		for(const list of needs_sort)
			list.sort((a, b) => {
				if ( a.sort < b.sort ) return -1;
				if ( a.sort > b.sort ) return 1;

				return a.key && a.key.localeCompare(b.key);
			});

		const items = root.items || [];
		items.keys = copies;

		// Save for now, since we just want to mark everything as seen.
		if ( new_seen )
			this.settings.provider.set('cfg-seen', new_seen);

		if ( ! collapsed ) {
			const new_collapsed = [];
			for(const key of Object.keys(copies)) {
				const item = copies[key];
				if ( item && item.items && item.parent )
					new_collapsed.push(key);
			}

			this.settings.provider.set('cfg-collapsed', new_collapsed);
		}

		this.log.info(`Built Tree in ${(performance.now() - started).toFixed(5)}ms with ${Object.keys(tree).length} structure nodes and ${this._settings_count} settings nodes.`);
		return items;
	}


	getProfiles(context) {
		const profiles = [],
			keys = {};

		context = context || this.settings.main_context;

		for(const profile of this.settings.__profiles)
			profiles.push(keys[profile.id] = this.getProfileProxy(profile, context));

		return [profiles, keys];
	}


	getProfileProxy(profile, context) { // eslint-disable-line class-methods-use-this
		return {
			id: profile.id,

			order: context.manager.__profiles.indexOf(profile),
			live: context.__profiles.includes(profile),

			toggled: profile.toggled,

			title: profile.name,
			i18n_key: profile.i18n_key,

			description: profile.description,
			desc_i18n_key: profile.desc_i18n_key || profile.i18n_key && `${profile.i18n_key}.description`,

			url: profile.url,

			move: idx => context.manager.moveProfile(profile.id, idx),
			save: () => profile.save(),
			update: data => {
				profile.data = deep_copy(data)
				profile.save()
			},

			toggle: () => profile.toggled = ! profile.toggled,
			getBackup: () => deep_copy(profile.getBackup()),

			context: deep_copy(profile.context),

			get: key => profile.get(key),
			set: (key, val) => profile.set(key, val),
			delete: key => profile.delete(key),
			has: key => profile.has(key),

			on: (...args) => profile.on(...args),
			off: (...args) => profile.off(...args)
		}
	}


	getContext() {
		const t = this,
			Vue = this.vue.Vue,
			settings = this.settings,
			context = settings.main_context,
			[profiles, profile_keys] = this.getProfiles(),

			_c = {
				profiles,
				profile_keys,
				currentProfile: profile_keys[0],

				has_update: this.has_update,

				createProfile: data => {
					const profile = settings.createProfile(data);
					return t.getProfileProxy(profile, context);
				},

				deleteProfile: profile => settings.deleteProfile(profile),

				context: {
					_users: 0,

					profiles: context.__profiles.map(profile => profile.id),
					get: key => context.get(key),
					uses: key => context.uses(key),

					on: (...args) => context.on(...args),
					off: (...args) => context.off(...args),

					order: id => context.order.indexOf(id),
					context: deep_copy(context._context),

					_update_profiles(changed) {
						const new_list = [],
							profiles = context.manager.__profiles;

						for(let i=0; i < profiles.length; i++) {
							const profile = profile_keys[profiles[i].id];
							profile.order = i;

							new_list.push(profile);
						}

						Vue.set(_c, 'profiles', new_list);

						if ( changed && changed.id === _c.currentProfile.id )
							_c.currentProfile = profile_keys[changed.id];
					},

					_profile_created(profile) {
						Vue.set(profile_keys, profile.id, t.getProfileProxy(profile, context));
						this._update_profiles()
					},

					_profile_changed(profile) {
						Vue.set(profile_keys, profile.id, t.getProfileProxy(profile, context));
						this._update_profiles(profile);
					},

					_profile_toggled(profile, val) {
						Vue.set(profile_keys[profile.id], 'toggled', val);
						this._update_profiles(profile);
					},

					_profile_deleted(profile) {
						Vue.delete(profile_keys, profile.id);
						this._update_profiles();

						if ( _c.currentProfile.id === profile.id )
							_c.currentProfile = profile_keys[0]
					},

					_context_changed() {
						this.context = deep_copy(context._context);
						const profiles = context.manager.__profiles,
							ids = this.profiles = context.__profiles.map(profile => profile.id);

						for(let i=0; i < profiles.length; i++) {
							const id = profiles[i].id,
								profile = profile_keys[id];

							profile.live = ids.includes(id);
						}
					},

					_add_user() {
						this._users++;
						if ( this._users === 1 ) {
							settings.on(':profile-toggled', this._profile_toggled, this);
							settings.on(':profile-created', this._profile_created, this);
							settings.on(':profile-changed', this._profile_changed, this);
							settings.on(':profile-deleted', this._profile_deleted, this);
							settings.on(':profiles-reordered', this._update_profiles, this);
							context.on('context_changed', this._context_changed, this);
							context.on('profiles_changed', this._context_changed, this);
							this.profiles = context.__profiles.map(profile => profile.id);
						}
					},

					_remove_user() {
						this._users--;
						if ( this._users === 0 ) {
							settings.off(':profile-toggled', this._profile_toggled, this);
							settings.off(':profile-created', this._profile_created, this);
							settings.off(':profile-changed', this._profile_changed, this);
							settings.off(':profile-deleted', this._profile_deleted, this);
							settings.off(':profiles-reordered', this._update_profiles, this);
							context.off('context_changed', this._context_changed, this);
							context.off('profiles_changed', this._context_changed, this);
						}
					}
				}
			};

		return _c;
	}

	markSeen(item, seen) {
		let had_seen = true;
		if ( ! seen ) {
			had_seen = false;
			seen = this.settings.provider.get('cfg-seen', []);
		}

		if ( Array.isArray(item.contents) ) {
			for(const child of item.contents)
				child && this.markSeen(child, seen);

		}

		if ( item.setting ) {
			if ( ! seen.includes(item.setting) ) {
				seen.push(item.setting);

				let i = item.parent;
				while(i) {
					i.unseen = (i.unseen || 1) - 1;
					i = i.parent;
				}
			}
		}

		if ( ! had_seen )
			this.settings.provider.set('cfg-seen', seen);
	}

	markAllSeen(thing, seen) {
		let had_seen = true;
		if ( ! seen ) {
			had_seen = false;
			seen = this.settings.provider.get('cfg-seen', []);
		}

		if ( Array.isArray(thing) )
			for(const page of thing)
				if ( page )
					this.markAllSeen(page, seen);

		if ( Array.isArray(thing.items) )
			for(const item of thing.items)
				this.markAllSeen(item, seen);

		if ( Array.isArray(thing.contents) )
			for(const content of thing.contents)
				this.markAllSeen(content, seen);

		if ( Array.isArray(thing.tabs) )
			for(const tab of thing.tabs)
				this.markAllSeen(tab, seen);

		if ( Array.isArray(thing.settings) )
			for(const setting of thing.settings)
				if ( setting )
					this.markAllSeen(setting[1], seen);

		if ( thing.setting && ! seen.includes(thing.setting) )
			seen.push(thing.setting);

		if ( thing.unseen )
			thing.unseen = 0;

		if ( ! had_seen )
			this.settings.provider.set('cfg-seen', seen);
	}

	getData() {
		const settings = this.getSettingsTree(),
			context = this.getContext(),
			current = (this._wanted_page && settings.keys[this._wanted_page]) || (this.has_update ? settings.keys['home.changelog'] : settings.keys['home']);

		this._wanted_page = null;
		this.markSeen(current);

		let has_unseen = false;
		for(const page of settings)
			if ( page && page.unseen ) {
				has_unseen = true;
				break;
			}


		const out = {
			context,

			query: '',
			faded: false,

			nav: settings,
			currentItem: current,
			nav_keys: settings.keys,

			has_unseen,

			maximized: this.dialog.maximized,
			exclusive: this.dialog.exclusive,

			markAllSeen: thing => this.markAllSeen(thing),
			markSeen: item => this.markSeen(item),

			markExpanded: item => {
				const collapsed = this.settings.provider.get('cfg-collapsed', []),
					included = collapsed.indexOf(item.full_key);

				if ( item.expanded && included !== -1 )
					collapsed.splice(included, 1);
				else if ( ! item.expanded && included === -1 )
					collapsed.push(item.full_key);
				else
					return;

				this.settings.provider.set('cfg-collapsed', collapsed);
			},

			resize: e => {
				if ( this.dialog.exclusive || this.site?.router?.current_name === 'squad' || this.site?.router?.current_name === 'command-center' )
					return;

				if ( this.settings.get('context.ui.theatreModeEnabled') )
					return;

				this.dialog.toggleSize(e);
			},

			close: e => ! this.dialog.exclusive && this.dialog.toggleVisible(e),

			popout: e => {
				if ( this.dialog.exclusive )
					return;

				this.dialog.toggleVisible(e);
				if ( ! this.openPopout() )
					alert(this.i18n.t('popup.error', 'We tried opening a pop-up window and could not. Make sure to allow pop-ups from Twitch.')); // eslint-disable-line no-alert
			},

			version: window.FrankerFaceZ.version_info,
		};

		return out;
	}
}