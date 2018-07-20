'use strict';

// ============================================================================
// Menu Module
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';
import {has, deep_copy} from 'utilities/object';

import {parse_path} from 'src/settings';

const EXCLUSIVE_SELECTOR = '.twilight-main,.twilight-minimal-root>div,.twilight-root>.tw-full-height,.clips-root',
	MAXIMIZED_SELECTOR = '.twilight-main,.twilight-minimal-root,.twilight-root .dashboard-side-nav+.tw-full-height,.clips-root>.tw-full-height .scrollable-area',
	SELECTOR = '.twilight-root>.tw-full-height,.twilight-minimal-root>.tw-full-height,.clips-root>.tw-full-height .scrollable-area';

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

		//this.should_enable = true;

		this._settings_tree = null;
		this._settings_count = 0;

		this._menu = null;
		this._visible = true;
		this._maximized = false;
		this.exclusive = false;
		this.has_update = false;

		this.settings.addUI('profiles', {
			path: 'Data Management @{"sort": 1000, "profile_warning": false} > Profiles @{"profile_warning": false}',
			component: 'profile-manager'
		});

		this.settings.addUI('home', {
			path: 'Home @{"sort": -1000, "profile_warning": false}',
			component: 'home-page'
		});

		this.settings.addUI('feedback', {
			path: 'Home > Feedback',
			component: 'feedback-page'
		});

		this.settings.addUI('changelog', {
			path: 'Home > Changelog',
			component: 'changelog'
		});

		this.on('socket:command:new_version', version => {
			if ( version === window.FrankerFaceZ.version_info.commit )
				return;

			this.log.info('New Version Available', version);
			this.has_update = true;

			const mb = this.resolve('site.menu_button');
			if ( mb )
				mb.has_update = true;

			if ( this._vue )
				this._vue.$children[0].context.has_update = true;
		});
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

	get maximized() {
		return this._maximized;
	}

	set maximized(val) {
		val = Boolean(val);
		if ( val === this._maximized )
			return;

		if ( this.enabled )
			this.toggleSize();
	}

	get visible() {
		return this._visible;
	}

	set visible(val) {
		val = Boolean(val);
		if ( val === this._visible )
			return;

		if ( this.enabled )
			this.toggleVisible();
	}


	async onEnable(event) {
		await this.site.awaitElement(EXCLUSIVE_SELECTOR);

		this.on('site.menu_button:clicked', this.toggleVisible);
		if ( this._visible ) {
			this._visible = false;
			this.toggleVisible(event);
		}
	}

	onDisable() {
		if ( this._visible ) {
			this.toggleVisible();
			this._visible = true;
		}

		this.off('site.menu_button:clicked', this.toggleVisible);
	}

	getContainer() {
		if ( this.exclusive )
			return document.querySelector(EXCLUSIVE_SELECTOR);

		if ( this._maximized )
			return document.querySelector(MAXIMIZED_SELECTOR);

		return document.querySelector(SELECTOR);
	}

	toggleVisible(event) {
		if ( event && event.button !== 0 )
			return;

		const maximized = this._maximized,
			visible = this._visible = !this._visible,
			main = this.getContainer();

		if ( ! visible ) {
			if ( maximized )
				main.classList.remove('ffz-has-menu');

			if ( this._menu ) {
				this._menu.remove();
				this._vue.$destroy();
				this._menu = this._vue = null;
			}

			return;
		}

		if ( ! this._menu )
			this.createMenu();

		if ( maximized )
			main.classList.add('ffz-has-menu');

		main.appendChild(this._menu);
	}

	toggleSize(event) {
		if ( ! this._visible || event && event.button !== 0 )
			return;

		const maximized = this._maximized = !this._maximized,
			main = this.getContainer(),
			old_main = this._menu.parentElement;

		if ( maximized )
			main.classList.add('ffz-has-menu');
		else
			old_main.classList.remove('ffz-has-menu');

		this._menu.remove();
		main.appendChild(this._menu);

		this._vue.$children[0].maximized = maximized;
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
			expanded = this.settings.provider.get('settings-expanded', {}),
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
					expanded: prefix === null,
					i18n_key: `setting.${key}`,
					desc_i18n_key: `setting.${key}.description`
				};

			Object.assign(token, raw_token);

			if ( has(expanded, key) )
				token.expanded = expanded[key];

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

			root = {},
			copies = {},

			needs_sort = new Set,
			needs_component = new Set,

			have_locale = this.i18n.locale !== 'en';


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

			if ( token.page && ! token.component )
				needs_component.add(token);

			if ( token.settings ) {
				const list = token.contents = token.contents || [];

				for(const [setting_key, def] of token.settings)
					if ( def.ui ) { //} && def.ui.title ) {
						const i18n_key = `${token.i18n_key}.${def.ui.key}`
						const tok = Object.assign({
							i18n_key,
							desc_i18n_key: `${i18n_key}.description`,
							sort: 0,
							title: setting_key
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

						const terms = [
							setting_key,
							this.i18n.t(tok.i18n_key, tok.title, tok, true)
						];

						if ( have_locale && this.i18n.has(tok.i18n_key) )
							terms.push(this.i18n.t(tok.i18n_key, tok.title, tok));

						if ( tok.description ) {
							terms.push(this.i18n.t(tok.desc_i18n_key, tok.description, tok, true));

							if ( have_locale && this.i18n.has(tok.desc_i18n_key) )
								terms.push(this.i18n.t(tok.desc_i18n_key, tok.description, tok));
						}

						tok.search_terms = terms.map(format_term).join('\n');

						list.push(tok);
					}

				token.settings = undefined;
				if ( list.length > 1 )
					needs_sort.add(list);
			}

			if ( ! token.search_terms ) {
				const formatted = this.i18n.t(token.i18n_key, token.title, token, true);
				let terms = [token.key];

				if ( formatted && formatted.localeCompare(token.key, undefined, {sensitivity: 'base'}) )
					terms.push(formatted);

				if ( have_locale && this.i18n.has(token.i18n_key) )
					terms.push(this.i18n.t(token.i18n_key, token.title, token));

				if ( token.description ) {
					terms.push(this.i18n.t(token.desc_i18n_key, token.description, token, true));

					if ( have_locale && this.i18n.has(token.desc_i18n_key) )
						terms.push(this.i18n.t(token.desc_i18n_key, token.description, token));
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

		this.log.info(`Built Tree in ${(performance.now() - started).toFixed(5)}ms with ${Object.keys(tree).length} structure nodes and ${this._settings_count} settings nodes.`);
		const items = root.items || [];
		items.keys = copies;
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

			title: profile.name,
			i18n_key: profile.i18n_key,

			description: profile.description,
			desc_i18n_key: profile.desc_i18n_key || profile.i18n_key && `${profile.i18n_key}.description`,

			move: idx => context.manager.moveProfile(profile.id, idx),
			save: () => profile.save(),
			update: data => {
				profile.data = data
				profile.save()
			},

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
					context: deep_copy(context.context),

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

					_profile_deleted(profile) {
						Vue.delete(profile_keys, profile.id);
						this._update_profiles();

						if ( _c.currentProfile.id === profile.id )
							_c.currentProfile = profile_keys[0]
					},

					_context_changed() {
						this.context = deep_copy(context.context);
						const ids = this.profiles = context.__profiles.map(profile => profile.id);
						for(const id of ids) {
							const profile = profiles[id];
							profile.live = this.profiles.includes(profile.id);
						}
					},

					_add_user() {
						this._users++;
						if ( this._users === 1 ) {
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

	getData() {
		const settings = this.getSettingsTree(),
			context = this.getContext();

		return {
			context,

			query: '',
			faded: false,

			nav: settings,
			currentItem: this.has_update ?
				settings.keys['home.changelog'] :
				settings.keys['home'], // settings[0],
			nav_keys: settings.keys,

			maximized: this._maximized,
			resize: e => !this.exclusive && this.toggleSize(e),
			close: e => !this.exclusive && this.toggleVisible(e),
			popout: e => {
				if ( this.exclusive )
					return;

				this.toggleVisible(e);
				if ( ! this.openPopout() )
					alert(this.i18n.t('popup.error', 'We tried opening a pop-up window and could not. Make sure to allow pop-ups from Twitch.'));
			},
			version: window.FrankerFaceZ.version_info,

			exclusive: this.exclusive
		}
	}

	createMenu() {
		if ( this._menu )
			return;

		this._vue = new this.vue.Vue({
			el: createElement('div'),
			render: h => h('main-menu', this.getData())
		});

		this._menu = this._vue.$el;
	}
}