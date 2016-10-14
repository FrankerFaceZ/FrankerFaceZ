var FFZ = window.FrankerFaceZ,
	constants = require("../constants"),
	utils = require("../utils"),
	createElement = utils.createElement,

	BANNED_KEYS = ['user_ip'];


// -------------------
// Initialization
// -------------------

/*FFZ.prototype._has_news = false;
FFZ.prototype._news_id = 0;

FFZ.prototype.check_news = function(tries) {
	jQuery.ajax(constants.SERVER + "script/news.json", {cache: false, dataType: "json", context: this})
		.done(function(data) {
			FFZ.ws_commands.update_news.call(this, data.id);
		}).fail(function(data) {
			if ( data.status === 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				setTimeout(this.check_news.bind(this, tries), Math.floor(Math.random()*5)*1000);
		});
}


FFZ.ws_commands.update_news = function(version) {
	var old_version = parseInt(localStorage.ffzLastNewsId || "0") || 0;
	if ( ! old_version || Number.isNaN(old_version) || old_version < 0 )
		old_version = 0;

	if ( version <= old_version ) {
		this._news_id = old_version;
		return;
	}

	this._has_news = true;
	this._news_id = version;
	this.update_ui_link();
}*/


// -------------------
// About Page
// -------------------

FFZ.debugging_blocks = {
	version: {
		order: 1,
		title: "Version Breakdown",
		refresh: false,
		type: "list",

		render: function() {
			var output = [
				['Ember', Ember.VERSION],
				['Ember Data', window.DS && DS.VERSION || '<i>unknown</i>'],
				['GIT Version', EmberENV.GIT_VERSION],
				null,
				['FrankerFaceZ', FFZ.version_info.toString()]
			];

			if ( this.has_bttv )
				output.push(['BetterTTV', BetterTTV.info.version + 'r' + BetterTTV.info.release]);

			if ( Object.keys(this._apis).length ) {
				output.push(null);
				for(var key in this._apis) {
					var api = this._apis[key];
					output.push(['<b>Ext #' + api.id + '.</b> ' + api.name, api.version || '<i>unknown</i>']);
				}
			}

			return output;
		}
	},

	socket: {
		order: 2,
		title: "WS Client Status",
		refresh: 5000,
		type: "list",

		render: function() {
			this.ws_ping(true);

			var last_ping = this._ws_last_ping;
			if ( typeof last_ping === "number" )
				last_ping = (Math.floor(last_ping * 1000) / 1000) + 'ms';

			var offset = this._ws_sock && this._ws_server_offset && (Math.floor(this._ws_server_offset) / 1000);
			if ( typeof offset === "number" )
				offset = (offset < 0 ? '-' : '') + utils.time_to_string(Math.abs(offset));

			return [
				['Client ID', localStorage.ffzClientId || '<i>not set</i>'],
				['Socket Server', this._ws_sock && this._ws_sock.url || '<i>disconnected</i>'],
				['Server Ping', last_ping || '<i>unknown</i>'],
				['Time Offset', offset || '<i>unknown</i>']
			]
		}
	},

	logviewer: {
		order: 3,
		title: "Logviewer Status",
		refresh: true,
		type: "list",

		render: function() {
			var f = this,
				chat = utils.ember_lookup('controller:chat'),
				room_id = chat && chat.get('currentRoom.id'),
				ffz_room = room_id && this.rooms[room_id];

			return new Promise(function(succeed, fail) {
				f.lv_get_token().then(function(token) {
					var output = [
						['Authentication', '<i>succeeded</i>'],
						['Token Expires', new Date(f._lv_token.expires * 1000).toLocaleString()],
						['Socket Server', f._lv_ws_sock && f._lv_ws_sock.url || '<i>disconnected</i>'],
						['Socket Topics', f._lv_ws_topics && _.map(f._lv_ws_topics, function(x) { return '<code>' + x + '</code>' }).join(', ') || '<i>no topics</i>']
					];

					if ( ! ffz_room ) {
						output.push(['Current Room', '<i>none</i>']);
						return succeed(output);
					}

					output.push(['Current Room', room_id]);

					if ( ! ffz_room.logviewer_levels ) {
						output.push(['Logging Enabled', '<i>loading</i>']);

						utils.logviewer.get('channel/' + room_id, token)
								.then(utils.json).then(function(result) {
							f.log("[LV] Channel Info: " + room_id, result);
							ffz_room.logviewer_levels = result;
						});

						return succeed(output);
					}

					var data = ffz_room.logviewer_levels;

					if ( ! data.channel ) {
						output.push(['Logging Enabled', false]);
						return succeed(output);
					}

					var perms = [],
						ul = data.me.valid ? data.me.level : 0,
						chan = data.channel;

					ul >= chan.viewlogs && perms.push('view');
					ul >= chan.viewmodlogs && perms.push('view-mod');
					ul >= chan.viewcomments && perms.push('comment-view');
					ul >= chan.writecomments && perms.push('comment-write');
					ul >= chan.deletecomments && perms.push('comment-delete');

					output.push(['Logging Enabled', data.channel.active === 1]);
					output.push(['User Level', data.me.valid ? data.me.level : '<i>invalid</i>']);
					output.push(['User Permissions', perms.join(', ') || '<i>none</i>']);

					succeed(output);

				}).catch(function(err) {
					succeed([['Authentication', '<i>unable to get token</i>']]);
				});
			});
		}
	},

	twitch: {
		order: 4,
		title: "Twitch Configuration",
		refresh: false,
		type: "list",

		render: function() {
			var user = this.get_user(),
				output = [ ['Deploy Flavor', SiteOptions.deploy_flavor] ];

			if ( user && user.login ) {
				output.push(['Current User', user.login + ' [' + user.id + ']']);
				var us = [];

				user.is_staff && us.push('staff');
				user.is_admin && us.push('admin');
				user.is_partner && us.push('partner');
				user.is_broadcaster && us.push('broadcaster');
				user.has_premium && us.push('premium');
				user.has_turbo && us.push('turbo');
				user.account_verified && us.push('verified');

				output.push(['User State', us.join(', ') || '<i>none</i>']);
			} else
				output.push(['Current User', '<i>not logged in</i>']);

			if ( window.Twitch && Twitch.geo && Twitch.geo._result ) {
				var data = Twitch.geo._result;
				if ( data.geo )
					output.push(['Region', data.geo + (data.eu ? ' [EU]' : '')]);

				if ( data.received_language )
					output.push(['Received Language', data.received_language]);
			}

			return output;
		}
	},

	experiments: {
		order: 5,
		title: "Twitch Experiments",
		refresh: false,
		type: "list",

		render: function() {
			var exp_service = utils.ember_lookup('service:experiments'),
				output = [];

			if ( exp_service ) {
				for(var key in exp_service.values) {
					if ( ! exp_service.values.hasOwnProperty(key) )
						continue;

					output.push([key, exp_service.values[key]]);
				}
			}

			return output;
		}
	},

	memory: {
		order: 6,
		title: "Memory Statistics",
		refresh: true,
		type: "list",

		visible: function() { return window.performance && performance.memory },

		render: function() {
			var mem = performance.memory;
			return [
				['jsHeapSizeLimit', utils.format_size(mem.jsHeapSizeLimit) + ' (' + mem.jsHeapSizeLimit + ')'],
				['totalJSHeapSize', utils.format_size(mem.totalJSHeapSize) + ' (' + mem.totalJSHeapSize + ')'],
				['usedJSHeapSize',  utils.format_size(mem.usedJSHeapSize)  + ' (' + mem.usedJSHeapSize  + ')']
			]
		}
	},

	player: {
		order: 7,
		title: "Player Statistics",
		refresh: true,
		type: "list",

		get_player: function() {
			for(var key in this.players)
				if ( this.players[key] && ! this.players[key].isDestroyed && this.players[key].player )
					return this.players[key].player;
		},

		visible: function() { return FFZ.debugging_blocks.player.get_player.call(this) },

		render: function() {
			var player = FFZ.debugging_blocks.player.get_player.call(this),
				data;

			try {
				data = player.getVideoInfo();
			} catch(err) {}

			if ( ! data )
				return [];

			try {
				data.backend = player.getBackend();
				data.version = player.getVersion();
			} catch(err) {}

			var sorted_keys = Object.keys(data).sort(),
				output = [];

			for(var i=0; i < sorted_keys.length; i++) {
				var key = sorted_keys[i];
				if ( BANNED_KEYS.indexOf(key) === -1 )
					output.push([key, data[key]]);
			}

			return output;
		}
	},

	settings: {
		order: 8,
		title: "Current Settings",
		refresh: false,
		type: "text",

		render: function() {
			var output = this._get_settings_object(true).settings;
			delete output.favorite_settings;
			delete output.mod_card_reasons;
			delete output.emote_menu_collapsed;
			delete output.favorite_emotes;

			return JSON.stringify(output, null, 2);
		}
	},

	logs: {
		order: 100,
		title: "Logs",
		refresh: false,
		type: "text",

		render: function() {
			return this._log_data.join("\n");
		}
	}
}

FFZ.prototype._sorted_debug_blocks = function() {
	var segments = [];
	for(var key in FFZ.debugging_blocks) {
		var info = FFZ.debugging_blocks[key];
		if ( ! info )
			continue;

		var visible = info.visible || true;
		if ( typeof visible === "function" )
			visible = visible.call(this);

		if ( ! visible )
			continue;

		segments.push([info.order || 50, info]);
	}

	segments.sort(function(a,b) { return a[0] > b[0] });
	return segments;
}

FFZ.prototype.get_debugging_info = function() {
	var f = this;
	return new Promise(function(succeed, fail) {
		var output = [
			'FrankerFaceZ - Debugging Information',
			(new Date).toISOString(), ''];

		var segments = f._sorted_debug_blocks(),
			promises = [];

		for(var i=0; i < segments.length; i++) {
			var info = segments[i][1];
			promises.push(new Promise(function(info, s) {
				var result = info.render.call(f);
				if (!( result instanceof Promise ))
					result = Promise.resolve(result);

				result.then(function(data) {
					var el = utils.createElement('span'),
						out = [info.title, '----------------------------------------'];
					if ( info.type === 'list' )
						for(var x=0; x < data.length; x++) {
							if ( data[x] ) {
								el.innerHTML = data[x].join(': ');
								out.push(el.textContent);
							} else
								out.push('');
						}
					else if ( info.type === 'text' )
						out.push(data);

					s(out);
				}).catch(function(err) {
					s(['', info.title, 'Error: ' + err]);
				});

			}.bind(f, info)));
		}

		Promise.all(promises).then(function(result) {
			for(var i=0; i < result.length; i++) {
				output.push.apply(output, result[i]);
				output.push('');
				output.push('');
			}

			succeed(output.join('\n').trim());
		});
	});
}


var include_html = function(heading_text, filename, callback) {
		return function(view, container) {
			var heading = createElement('div', 'chat-menu-content center');
			heading.innerHTML = '<h1>FrankerFaceZ</h1>' + (heading_text ? '<div class="ffz-about-subheading">' + heading_text + '</div>' : '');

			jQuery.ajax(filename, {cache: false, context: this})
				.done(function(data) {
					container.appendChild(heading);
					container.innerHTML += data;

					jQuery('#ffz-old-news-button', container).on('click', function() {
						jQuery(this).remove();
						jQuery('#ffz-old-news', container).css('display', 'block');
					});

					typeof callback === "function" && callback(view, container);

				}).fail(function(data) {
					var content = createElement('div', 'chat-menu-content menu-side-padding');
					content.textContent = 'There was an error loading this page from the server.';

					container.appendChild(heading);
					container.appendChild(content);
				});
		}
	},
	render_news = include_html("news", constants.SERVER + "script/news.html");


FFZ.menu_pages.about = {
	name: "About",
	icon: constants.HEART,
	sort_order: 100000,

	pages: {
		about: {
			name: "About",
			render: function(view, container, inner, menu) {
				var room = this.rooms[view.get('room.id')],
					has_emotes = false, f = this;

				if ( room && room.set ) {
					var set = this.emote_sets[room.set];
					if ( set && set.count > 0 )
						has_emotes = true;
				}

				// Heading
				var heading = createElement('div'),
					content = '';

				content += "<h1>FrankerFaceZ</h1>";
				content += '<div class="ffz-about-subheading">new ways to woof</div>';

				heading.className = 'chat-menu-content center';
				heading.innerHTML = content;
				container.appendChild(heading);

				var clicks = 0, head = heading.querySelector("h1");
				head && head.addEventListener("click", function() {
					head.style.cursor = "pointer";
					clicks++;
					if ( clicks >= 3 ) {
						clicks = 0;
						var el = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");
						el && el.classList.toggle('ffz-flip');
					}
					setTimeout(function(){clicks=0;head.style.cursor=""},2000);
				});


				// Button Stuff
				var btn_container = createElement('div', 'chat-menu-content center'),
					more_buttons = createElement('div', 'chat-menu-content center'),

					ad_button = createElement('a', 'button primary', 'Advertise in Chat'),
					donate_button = createElement('a', 'button ffz-donate mg-l-1', 'Donate'),
					issue_button = createElement('a', 'button ffz-issues', 'Bugs &amp; Issues'),
					idea_button = createElement('a', 'button ffz-ideas mg-l-1', 'Ideas'),

					message = "To use custom emoticons in " + (has_emotes ? "this channel" : "tons of channels") + ", get FrankerFaceZ from https://www.frankerfacez.com";

				// Advertising
				ad_button.addEventListener('click', this._add_emote.bind(this, view, message));
				btn_container.appendChild(ad_button);

				// Donate
				donate_button.href = "https://www.frankerfacez.com/donate";
				donate_button.target = "_blank";
				btn_container.appendChild(donate_button);

				// Issues
				issue_button.href = "https://github.com/FrankerFaceZ/FrankerFaceZ/labels/bug";
				issue_button.target = "_blank";
				more_buttons.appendChild(issue_button);

				// Ideas
				idea_button.href = "https://github.com/FrankerFaceZ/FrankerFaceZ/labels/enhancement";
				idea_button.target = "_blank";
				more_buttons.appendChild(idea_button);


				container.appendChild(btn_container);
				container.appendChild(more_buttons);


				// Credits
				var credits = createElement('div');

				content = '<table class="ffz-about-table">';
				content += '<tr><th colspan="4">Developers</th></tr>';
				content += '<tr><td>Dan Salvato</td><td><a class="twitch" href="//www.twitch.tv/dansalvato" title="Twitch" target="_blank">&nbsp;</a></td><td><a class="twitter" href="https://twitter.com/dansalvato" title="Twitter" target="_blank">&nbsp;</a></td><td><a class="youtube" href="https://www.youtube.com/user/dansalvato1" title="YouTube" target="_blank">&nbsp;</a></td></tr>';
				content += '<tr><td>Stendec</td><td><a class="twitch" href="//www.twitch.tv/sirstendec" title="Twitch" target="_blank">&nbsp;</a></td><td><a class="twitter" href="https://twitter.com/SirStendec" title="Twitter" target="_blank">&nbsp;</a></td><td><a class="youtube" href="https://www.youtube.com/channel/UCnxuvmK1DCPCXSJ-mXIh4KQ" title="YouTube" target="_blank">&nbsp;</a></td></tr>';

				content += '<tr class="debug"><td><a href="#" id="ffz-changelog">Version ' + FFZ.version_info + '</a></td><td colspan="3"><a href="#" id="ffz-debug-logs">Logs</a></td></tr>';

				credits.className = 'chat-menu-content center';
				credits.innerHTML = content;

				// Make the Version clickable.
				credits.querySelector('#ffz-changelog').addEventListener('click',
					f._ui_change_subpage.bind(f, view, inner, menu, container, 'changelog'));

				// Make the Logs button functional.
				var getting_logs = false;
				credits.querySelector('#ffz-debug-logs').addEventListener('click', function() {
					if ( getting_logs )
						return;

					getting_logs = true;

					f.get_debugging_info().then(function(data) {
						f._pastebin(data).then(function(url) {
							getting_logs = false;
							prompt("Your FrankerFaceZ logs have been uploaded to the URL:", url);
						}).catch(function() {
							getting_logs = false;
							alert("An error occured uploading your FrankerFaceZ logs.");
						});
					});
				});

				container.appendChild(credits);
			}
		},

		changelog: {
			name: "Changes",
			wide: true,
			render: include_html("change log", constants.SERVER + "script/changelog.html")
		},

		/*news: {
			name: "News",
			wide: true,
			render: function(view, container) {
				if ( this._has_news ) {
					this._has_news = false;
					localStorage.ffzLastNewsId = this._news_id;
					this.update_ui_link();
				}

				return render_news.call(this, view, container);
			}
		},*/

		credits: {
			name: "Credit",
			wide: true,
			render: include_html("credits", constants.SERVER + "script/credits.html")
		},

		/*status: {
			name: "Status",
			wide: true,
			render: include_html("server status", constants.SERVER + "script/status.html", function(view, container) {

			})
		},*/

		debugging: {
			name: "Debug",
			wide: true,
			render: function(view, container) {
				var f = this;

				// Heading!
				container.appendChild(createElement('div', 'chat-menu-content center',
					'<h1>FrankerFaceZ</h1><div class="ffz-about-subheading">woofs for nerds</div>'));

				var segments = this._sorted_debug_blocks();
				for(var i=0; i < segments.length; i++) {
					var info = segments[i][1],
						output;

					if ( info.type === 'list' )
						output = createElement('ul', 'chat-menu-content menu-side-padding version-list');
					else if ( info.type === 'text' )
						output = createElement('pre', 'chat-menu-content menu-side-padding');
					else
						continue;

					container.appendChild(createElement('div', 'list-header', info.title));
					container.appendChild(output);

					var update_content = function(info, output, func) {
						// If we've removed this from the DOM, stop updating it!
						if ( ! document.body.contains(output) )
							return;

						var result = info.render.call(f);
						if ( ! (result instanceof Promise) )
							result = Promise.resolve(result);

						result.then(function(data) {
							if ( info.type === 'list' ) {
								var handled_keys = [],
									had_keys = output.childElementCount > 0;

								for(var i=0; i < data.length; i++) {
									var pair = data[i];
									if ( pair === null ) {
										if ( ! had_keys ) {
											var line = createElement('li', '', '<br>');
											line.setAttribute('data-key', 'null');
											handled_keys.push('null');
											output.appendChild(line);
										}
										continue;
									}

									var key = pair[0], value = pair[1],
										line = output.querySelector('li[data-key="' + key + '"]');

									if ( value === null )
										continue;

									handled_keys.push(key);

									if ( ! line ) {
										line = createElement('li');
										line.setAttribute('data-key', key);
										line.innerHTML = key + '<span></span>';
										output.appendChild(line);
									}

									line.querySelector('span').innerHTML = value;
								}

								var lines = output.querySelectorAll('li');
								for(var i=0; i < lines.length; i++) {
									var line = lines[i];
									if ( handled_keys.indexOf(line.getAttribute('data-key')) === -1 )
										output.removeChild(line);
								}

							} else if ( info.type === 'text' ) {
								output.textContent = data;
							}

							if ( info.refresh )
								setTimeout(func.bind(f, info, output, func), typeof info.refresh === "number" ? info.refresh : 1000);

						}).catch(function(err) {
							f.error("Debugging Menu Error", err);

							if ( info.type === 'list' )
								output.innerHTML = '<li><i>An error occured while updating this information.</i></li>';
							else
								output.innerHTML = 'An error occured while updating this information.';

							if ( info.refresh )
								setTimeout(func.bind(f, info, output, func), typeof info.refresh === "number" ? info.refresh : 1000);
						});

					};

					update_content.call(f, info, output, update_content);
				}
			}
		}
	}
}