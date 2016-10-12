var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// ----------------
// Token Request
// ----------------

FFZ.prototype._lv_token_requests = null;
FFZ.prototype._lv_token = {"token": null, "expires": 0};

FFZ.prototype.lv_get_token = function() {
	var f = this,
		token = this._lv_token,
		now = Date.now() / 1000;

	return new Promise(function(succeed, fail) {
		// If we're not logged in, we can't get a token.
		var user = f.get_user();
		if ( ! user || ! user.login )
			return fail(null);

		// Make sure the token will be valid for at least 5 more minutes.
		if ( token.token && token.expires > (now + 300) )
			return succeed(token.token);

		// If we're already making a request, don't duplicate it.
		if ( f._lv_token_requests )
			return f._lv_token_requests.push([succeed, fail]);

		// Nope, new request.
		f._lv_token_requests = [[succeed, fail]];

		f.ws_send("get_logviewer_token", undefined, function(succeeded, data) {
			token = succeeded ? data : token = {"token": null, "expires": 0};

			var requests = f._lv_token_requests;
			f._lv_token = token;
			f._lv_token_requests = null;

			for(var i=0; i < requests.length; i++) {
				requests[i][succeeded ? 0 : 1](token.token);
			}

			if ( succeeded && f._lv_ws_open )
				f._lv_ws_sock.send('42' + JSON.stringify(["token", token]));

		}, true);
	});
}


// ----------------
// Log Requests
// ----------------

FFZ.prototype.lv_get_logs = function(room_id, user_id, ref_id, before_cnt, after_cnt) {
	var f = this;
	return new Promise(function(succeed, fail) {
		f.lv_get_token().then(function(token) {
			args = [];

			user_id !== undefined && user_id !== null && args.push('nick=' + user_id);
			ref_id !== undefined && ref_id !== null && args.push('id=' + ref_id);
			before_cnt !== undefined && before_cnt !== null && args.push('before=' + before_cnt);
			after_cnt !== undefined && after_cnt !== null && args.push('after=' + after_cnt)

			utils.logviewer.get("logs/" + room_id + "?" + args.join('&'), token)
				.then(utils.json).then(function(data) {
					// Parse every message immediately.
					var bound = f.lv_parse_message.bind(f);
					data.before = _.map(data.before, bound);
					data.after = _.map(data.after, bound);

					succeed(data);
				});
		});
	})
}


// ----------------
// Message Processing
// ----------------

FFZ.prototype.lv_parse_message = function(message) {
	var parsed = utils.parse_irc_privmsg(message.text),
		ffz_room = this.rooms && this.rooms[parsed.room],
		room = ffz_room && ffz_room.room;

	parsed.lv_id = message.id;
	parsed.date = new Date(message.time * 1000);

	// Check for ban notices. Those are identifiable via display-name.
	parsed.is_ban = parsed.tags['display-name'] === 'jtv';
	if ( parsed.is_ban )
		parsed.style = 'admin';

	if ( parsed.tags.color )
		parsed.color = parsed.tags.color;
	else {
		var tmiSession = room && room.tmiSession || window.TMI && TMI._sessions && TMI._sessions[0];
		parsed.color = tmiSession && parsed.from ? tmiSession.getColor(parsed.from) : "#755000";
	}

	if ( ! parsed.tags.hasOwnProperty('mod') ) {
		var badges = parsed.tags.badges || {};
		parsed.tags.mod = parsed.from === parsed.room || badges.hasOwnProperty('staff') || badges.hasOwnProperty('admin') || badges.hasOwnProperty('global_mod') || badges.hasOwnProperty('moderator');
	}

	this.tokenize_chat_line(parsed, true, room && room.get('roomProperties.hide_chat_links'));
	return parsed;
}


// ---------------------
// WebSocket Connection
// ---------------------

FFZ.prototype.lv_ws_create = function() {
	var f = this, ws,
		server = constants.LV_SOCKET_SERVER + '?EIO=3&transport=websocket';

	if ( this._lv_ws_recreate_timer ) {
		clearTimeout(this._lv_ws_recreate_timer);
		this._lv_ws_recreate_timer = null;
	}

	if ( this._lv_ws_connecting || this._lv_ws_open )
		return;

	this._lv_ws_topics = this._lv_ws_topics || [];
	this._lv_ws_ping_timer = null;
	this._lv_ws_connecting = true;

	this.log('[LV] Using Socket Server: ' + server);

	try {
		ws = this._lv_ws_sock = new WebSocket(server);
	} catch(err) {
		this._lv_ws_sock = null;
		return this.error('[LV] Error creating WebSocket', err);
	}

	ws.onopen = function(e) {
		f._lv_ws_connecting = false;
		f._lv_ws_open = true;
		f.log('[LV] Socket connected.');

		ws.send('2probe');
		ws.send('5');

		if ( f._lv_token.token )
			ws.send('42' + JSON.stringify(["token", f._lv_token.token]));

		// Ping every 10 seconds just to be safe.
		f._lv_ws_ping_timer = setInterval(function() {
			ws.send('2');
		}, 10000);

		if ( f._lv_ws_topics.length )
			for(var i=0; i < f._lv_ws_topics.length; i++)
				ws.send('42' + JSON.stringify(["subscribe", f._lv_ws_topics[i]]));
		else
			f._lv_ws_close_timer = setTimeout(f.lv_ws_maybe_close.bind(f), 5000);
	}

	ws.onclose = function(e) {
		var was_open = f._lv_ws_open;
		f.log('[LV] Socket closed. (Code: ' + e.code + ', Reason: ' + e.reason + ')');

		f._lv_ws_open = false;
		f._lv_ws_connecting = false;
		f._lv_ws_sock = null;
		if ( f._lv_ws_ping_timer ) {
			clearInterval(f._lv_ws_ping_timer);
			f._lv_ws_ping_timer = null;
		}

		// Do we care about reconnecting? We only do if we have topics?
		if ( ! f._lv_ws_topics || ! f._lv_ws_topics.length )
			return;

		f._lv_ws_recreate_timer = setTimeout(f.lv_ws_create.bind(f), 500 + Math.random() * 2000);
	}

	ws.onmessage = function(e) {
		var message = e.data;
		// We only care about the meaning of life.
		if ( message.substr(0,2) !== '42' )
			return;

		var data = JSON.parse(message.substr(2));

		if ( f._lv_ws_callbacks && f._lv_ws_callbacks.length )
			for(var i=0; i < f._lv_ws_callbacks.length; i++)
				f._lv_ws_callbacks[i](data[0], data[1]);
	}
}


FFZ.prototype.lv_ws_add_callback = function(callback) {
	this._lv_ws_callbacks = this._lv_ws_callbacks || [];
	if ( this._lv_ws_callbacks.indexOf(callback) === -1 )
		this._lv_ws_callbacks.push(callback);
}


FFZ.prototype.lv_ws_remove_callback = function(callback) {
	this._lv_ws_callbacks = this._lv_ws_callbacks || [];
	var ind = this._lv_ws_callbacks.indexOf(callback);
	if ( ind !== -1 )
		this._lv_ws_callbacks.splice(ind, 1);
}


FFZ.prototype.lv_ws_sub = function(topic) {
	this._lv_ws_topics = this._lv_ws_topics || [];
	if ( this._lv_ws_topics.indexOf(topic) !== -1 )
		return;

	this._lv_ws_topics.push(topic);
	if ( this._lv_ws_close_timer ) {
		clearTimeout(this._lv_ws_close_timer);
		this._lv_ws_close_timer = null;
	}

	if ( this._lv_ws_open )
		this._lv_ws_sock.send("42" + JSON.stringify(['subscribe', topic]));

	else if ( ! this._lv_ws_connecting )
		this.lv_ws_create();
}

FFZ.prototype.lv_ws_unsub = function(topic) {
	this._lv_ws_topics = this._lv_ws_topics || [];
	var ind = this._lv_ws_topics.indexOf(topic);
	if ( ind === -1 )
		return;

	this._lv_ws_topics.splice(ind, 1);

	if ( this._lv_ws_open ) {
		this._lv_ws_sock.send("42" + JSON.stringify(['unsubscribe', topic]));
		if ( this._lv_ws_topics.length === 0 )
			this._lv_ws_close_timer = setTimeout(this.lv_ws_maybe_close.bind(this), 5000);
	}
}


FFZ.prototype.lv_ws_maybe_close = function() {
	if ( this._lv_ws_close_timer ) {
		clearTimeout(this._lv_ws_close_timer);
		this._lv_ws_close_timer = null;
	}

	if ( (! this._lv_ws_topics || ! this._lv_ws_topics.length) && this._lv_ws_open )
		this._lv_ws_sock.close();
}


// ----------------
// Moderation Card Pages
// ----------------

FFZ.mod_card_pages = {};

FFZ.mod_card_pages.default = {
	title: "<span>C</span>ontrols",
	render: function(mod_card, el) { }
}

FFZ.mod_card_pages.history = {
	title: "Chat <span>H</span>istory",

	render_more: function(mod_card, el, history, ref_id, is_user, is_after) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			user_id = mod_card.get('cardInfo.user.id'),
			room_id = controller && controller.get('currentRoom.id'),

			btn_more = utils.createElement('li', 'button ffz-load-more' + (is_after ? ' load-after' : ''), '<span class="ffz-chevron"></span> Load More <span class="ffz-chevron"></span>');

		if ( is_after )
			history.appendChild(btn_more);
		else
			history.insertBefore(btn_more, history.firstElementChild);

		btn_more.addEventListener('click', function() {
			history.scrollTop = 0;
			history.classList.add('loading');
			f.lv_get_logs(room_id, is_user ? user_id : null, ref_id, is_after ? 0 : 10, is_after ? 10 : 0).then(function(data) {
				history.removeChild(btn_more);
				history.classList.remove('loading');

				var messages = is_after ? data.after : data.before,
					last_message = history.querySelector('.chat-line:' + (is_after ? 'last' : 'first') + '-of-type'),
					last_date = last_message ? last_message.getAttribute('data-date') : (new Date).toLocaleDateString();

				if ( last_message.classList.contains('timestamp-line') )
					last_message.parentElement.removeChild(last_message);

				if ( ! is_after )
					messages.reverse();

				var original_message = history.querySelector('.original-msg'),
					original_sender = original_message && original_message.getAttribute('data-sender');

				for(var i=0; i < messages.length; i++) {
					var new_message = messages[i],
						date = new_message.date.toLocaleDateString(),
						date_line = null;

					new_message.original_sender = original_sender === new_message.from;

					var new_line = f._build_mod_card_history(
							new_message, mod_card, !is_user,
							FFZ.mod_card_pages.history.render_adjacent.bind(f, mod_card, el, new_message)
						);

					if ( is_user )
						new_line.classList.remove('ffz-mentioned');

					new_message.original_sender = null;

					if ( last_date !== date ) {
						date_line = utils.createElement('li', 'chat-line timestamp-line', is_after ? date : last_date);
						date_line.setAttribute('data-date', is_after ? date : last_date);
						last_date = date;
						if ( is_after )
							history.appendChild(date_line);
						else
							history.insertBefore(date_line, history.firstElementChild);
					}

					if ( is_after )
						history.appendChild(new_line);
					else
						history.insertBefore(new_line, history.firstElementChild);
				}

				if ( ! is_after && last_date !== (new Date).toLocaleDateString() ) {
					var date_line = utils.createElement('li', 'chat-line timestamp-line', last_date);
					date_line.setAttribute('data-date', last_date);
					history.insertBefore(date_line, history.firstElementChild);
				}

				// Only add the button back if there are even more messages to load.
				if ( messages.length >= 10 )
					if ( is_after )
						history.appendChild(btn_more);
					else
						history.insertBefore(btn_more, history.firstElementChild);

				var original = history.querySelector('.chat-line[data-lv-id="' + ref_id + '"]');
				if ( original )
					setTimeout(function() {
						history.scrollTop = (original.offsetTop - history.offsetTop) - (history.clientHeight - original.clientHeight) / 2;
					});

				ref_id = messages[messages.length-1].lv_id;
			});
		})
	},

	render_adjacent: function(mod_card, el, message) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			user_id = mod_card.get('cardInfo.user.id'),
			room_id = controller && controller.get('currentRoom.id'),
			ffz_room = this.rooms[room_id],

			old_history = el.querySelector('.chat-history'),
			history = el.querySelector('.adjacent-history');

		old_history.classList.add('hidden');

		if ( history )
			history.innerHTML = '';
		else {
			var btn_hide = utils.createElement('li', 'button ffz-back-button', '<span class="ffz-chevron"></span> Back'),
				btn_container = utils.createElement('ul', 'interface chat-history chat-back-button', btn_hide);

			btn_hide.addEventListener('click', function() {
				el.removeChild(history);
				el.removeChild(btn_container);
				old_history.classList.remove('hidden');
			})

			history = utils.createElement('ul', 'interface chat-history adjacent-history');
			el.appendChild(btn_container);
			el.appendChild(history);
		}

		history.classList.add('loading');

		f.lv_get_logs(room_id, null, message.lv_id, 10, 10).then(function(data) {
			history.classList.remove('loading');

			// Should we display more?
			if ( data.before.length >= 10 )
				FFZ.mod_card_pages.history.render_more.call(
					f, mod_card, el, history, data.before[0].lv_id, false, false);

			var last_date = (new Date).toLocaleDateString(),
				messages = _.union(data.before, [message], data.after);

			for(var i=0; i < messages.length; i++) {
				var new_message = messages[i],
					date = new_message.date.toLocaleDateString();

				if ( date !== last_date ) {
					var date_line = utils.createElement('li', 'chat-line timestamp-line', date);
					date_line.setAttribute('data-date', date);
					history.appendChild(date_line);
					last_date = date;
				}

				new_message.is_original = new_message.lv_id === message.lv_id;
				new_message.original_sender = new_message.from === message.from;

				var msg_line = f._build_mod_card_history(new_message, mod_card, true,
					FFZ.mod_card_pages.history.render_adjacent.bind(f, mod_card, el, new_message));

				if ( new_message.is_original )
					msg_line.classList.remove('ffz-mentioned');

				history.appendChild(msg_line);

				// These objects can be persistent, so clear these.
				new_message.is_original = null;
				new_message.original_sender = null;
			}

			if ( data.after.length >= 10 )
				FFZ.mod_card_pages.history.render_more.call(
					f, mod_card, el, history, data.after[data.after.length-1].lv_id, false, true);

			setTimeout(function() {
				var original = history.querySelector('.original-msg');
				if ( original )
					history.scrollTop = (original.offsetTop - history.offsetTop) - (history.clientHeight - original.clientHeight) / 2;
			})
		});
	},

	render: function(mod_card, el) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			user_id = mod_card.get('cardInfo.user.id'),
			room_id = controller && controller.get('currentRoom.id'),
			ffz_room = this.rooms[room_id],

			history = utils.createElement('ul', 'interface chat-history lv-history');

		el.appendChild(history);

		// Are we relying on LogViewer here?
		if ( ! ffz_room.has_logs || ! mod_card.lv_view ) {
			history.innerHTML = '<li class="chat-line admin"><span class="message">You do not have permission to view chat history in this channel.</span></li>';
			return;
		}

		// Start loading!
		history.classList.add('loading');

		mod_card.lvGetLogs().then(function(data) {
			history.classList.remove('loading');

			// Should we display more?
			if ( data.before.length >= 10 )
				FFZ.mod_card_pages.history.render_more.call(
					f, mod_card, el, history, data.before[0].lv_id, true, false);

			var last_date = (new Date).toLocaleDateString();

			if ( ! data.before.length )
				history.innerHTML = '<li class="message-line chat-line admin no-messages"><span class="message">(There are no logged messages to display.)</span></li>';

			for(var i=0; i < data.before.length; i++) {
				var message = data.before[i],
					date = message.date.toLocaleDateString();

				if ( date !== last_date ) {
					var date_line = utils.createElement('li', 'chat-line timestamp-line', date);
					date_line.setAttribute('data-date', date);
					history.appendChild(date_line);
					last_date = date;
				}

				var msg_line = f._build_mod_card_history(message, mod_card, false,
					FFZ.mod_card_pages.history.render_adjacent.bind(f, mod_card, el, message));

				msg_line.classList.remove('ffz-mentioned');
				history.appendChild(msg_line);
			}

			history.scrollTop = history.scrollHeight;
		});
	}
}

FFZ.mod_card_pages.stats = {
	title: "<span>S</span>tatistics",
	render: function(mod_card, el) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			room_id = controller && controller.get('currentRoom.id'),
			user_id = mod_card.get('cardInfo.user.id'),
			ffz_room = f.rooms && f.rooms[room_id];

		var container = utils.createElement('ul', 'interface version-list');
		el.appendChild(container);

		if ( ffz_room.has_logs && mod_card.lv_view ) {
			container.classList.add('loading');

			mod_card.lvGetLogs().then(function(data) {
				container.classList.remove('loading');
				container.innerHTML = '<li>Messages <span>' + utils.number_commas(data.user.messages) + '</span></li><li>Timeouts <span> ' + utils.number_commas(data.user.timeouts) + '</span></li>';
			});

			var notice = utils.createElement('div', 'interface');
			notice.innerHTML = 'Chat Log Source: <a target="_blank" href="https://cbenni.com/' + room_id + '?user=' + user_id + '">CBenni\'s logviewer</a>';
			el.appendChild(notice);
		}
	}
}

FFZ.mod_card_pages.notes = {
	title: "<span>N</span>otes",

	add_note: function(mod_card, el, note, history, last_line, do_scroll) {
		if ( ! history )
			history = el.querySelector('.chat-history.user-notes');

		if ( ! history )
			return;

		if ( ! last_line )
			last_line = history.querySelector('.chat-line:last-of-type');

		var was_at_bottom = do_scroll ? history.scrollTop >= (history.scrollHeight - history.clientHeight) : false,
			last_date = last_line ? last_line.getAttribute('data-date') : (new Date).toLocaleDateString();

		if ( last_line && last_line.classList.contains('no-messages') ) {
			last_line.parentElement.removeChild(last_line);
			last_line = null;
		}

		var output = FFZ.mod_card_pages.notes.build_note.call(this, mod_card, note),
			date = output.getAttribute('data-date');

		if ( last_date !== date ) {
			var date_line = utils.createElement('li', 'chat-line timestamp-line', date);
			date_line.setAttribute('data-date', date);
			history.appendChild(date_line);
		}

		history.appendChild(output);

		if ( was_at_bottom )
			setTimeout(function() { history.scrollTop = history.scrollHeight });

		return output;
	},

	build_note: function(mod_card, note) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			room = controller && controller.get('currentRoom'),
			user = this.get_user(),
			tmiSession = room.tmiSession || (window.TMI && TMI._sessions && TMI._sessions[0]),

			message = {
				date: new Date(note.added * 1000),
				from: note.author,
				room: note.channel,
				lv_id: note.id,
				message: note.text,
				tags: {
					'display-name': FFZ.get_capitalization(note.author)
				},
				color: tmiSession && note.author ? tmiSession.getColor(note.author) : "#755000"
			};

		this.tokenize_chat_line(message, true, false);

		var can_edit = false, // mod_card.lv_write_notes && user && user.login === message.from,
			can_delete = false, //mod_card.lv_delete_notes || (user && user.login === message.from),
			can_mod = can_edit || can_delete;

		var output = this._build_mod_card_history(message, mod_card, true, false, can_mod);

		if ( can_mod ) {
			var mod_icons = output.querySelector('.mod-icons');
			if ( can_delete ) {
				var btn_delete = utils.createElement('a', 'mod-icon html-tooltip delete-note', 'Delete');
				btn_delete.title = 'Delete Note';
				mod_icons.appendChild(btn_delete);

				btn_delete.addEventListener('click', function(e) {
					if ( e.ctrlKey || e.metaKey || e.altKey || btn_delete.classList.contains('loading') )
						return;

					btn_delete.classList.add('loading');

					f.lv_get_token().then(function(token) {
						utils.logviewer.del("comments/" + note.channel + "?id=" + note.id, token)
							.then(function(resp) {
								btn_delete.classList.remove('loading');
								if ( resp.ok )
									mod_card.lvOnMessage("comment-delete", note);
								else
									alert("An error occured deleting this note.");
							}).catch(function() {
								btn_delete.classList.remove('loading');
								alert("An error occured deleting this note.");
							});

					}).catch(function() {
						btn_delete.classList.remove('loading');
						alert("An error occured deleting this note.");
					})

					e.preventDefault();
					e.stopPropagation();
				});
			}

			/*if ( can_edit ) {
				var btn_edit = utils.createElement('a', 'mod-icon html-tooltip edit-note', 'Edit');
				btn_edit.title = 'Edit Note';
				mod_icons.appendChild(btn_edit);
			}*/
		}

		return output;
	},

	render: function(mod_card, el) {
		var f = this,
			controller = utils.ember_lookup('controller:chat'),
			room = controller && controller.get('currentRoom'),
			tmiSession = room.tmiSession || (window.TMI && TMI._sessions && TMI._sessions[0]),

			room_id = room && room.get('id'),
			user_id = mod_card.get('cardInfo.user.id'),

			ffz_room = this.rooms[room_id],
			history = utils.createElement('ul', 'interface chat-history user-notes');

		el.appendChild(history);

		if ( ! ffz_room.has_logs || ! mod_card.lv_view_notes ) {
			history.innerHTML = '<li class="chat-line admin"><span class="message">You do not have permission to view notes in this channel.</span></li>';
			return;
		}

		history.classList.add('loading');

		this.lv_get_token().then(function(token) {
			utils.logviewer.get("comments/" + room_id + "?topic=" + user_id, token)
					.then(utils.json).then(function(data) {

				f.log("[LV] Comments: " + user_id + " in " + room_id, data);
				history.classList.remove('loading');

				// We want to listen to get new notes for this user.
				mod_card._lv_sock_room = room_id;
				mod_card._lv_sock_user = user_id;
				f.lv_ws_sub(room_id + '-' + user_id);

				if ( data.length ) {
					var last_line = null;
					for(var i=0; i < data.length; i++)
						last_line = FFZ.mod_card_pages.notes.add_note.call(f, mod_card, el, data[i], history, last_line, false);
				}

				else
					history.appendChild(utils.createElement('li', 'chat-line message-line admin no-messages',
						'<span class="message">There are no notes on this user.</span>'));
			});
		});

		if ( mod_card.lv_write_notes ) {
			var textarea = utils.createElement('textarea', 'chat_text_input mousetrap note-text-input'),
				note_container = utils.createElement('div', 'interface textarea-contain note-input', textarea),
				btn_submit = utils.createElement('button', 'button float-right', 'Add Note'),
				btn_container = utils.createElement('div', 'chat-buttons-container clearfix', btn_submit),

			submit_note = function() {
				if ( note_container.classList.contains('loading') )
					return;

				var comment = textarea.value.trim();
				if ( ! comment.length )
					return;

				note_container.classList.add('loading');
				textarea.disabled = btn_submit.disabled = true;

				f.lv_get_token().then(function(token) {
					utils.logviewer.post("comments/" + room_id, null, {
						headers: {
							'Content-Type': 'application/json;charset=UTF-8'
						},
						body: JSON.stringify({
							comment: {
								topic: user_id,
								text: comment
							},
							token: token
						})
					}).then(function(resp) {
						note_container.classList.remove('loading');
						textarea.disabled = btn_submit.disabled = false;
						textarea.value = '';

						if ( resp.ok )
							textarea.placeholder = 'The note was posted successfully. Write another note...';
						else
							alert("An error occured posting this note.");

					}).catch(function() {
						note_container.classList.remove('loading');
						textarea.disabled = btn_submit.disabled = false;
						alert("An error occured posting this note.");
					});

				}).catch(function() {
					note_container.classList.remove('loading');
					textarea.disabled = btn_submit.disabled = false;
					alert("An error occured posting this note.");
				})

			};

			textarea.placeholder = 'Write a note about ' + user_id + '...';

			btn_submit.addEventListener('click', submit_note);
			note_container.appendChild(btn_container);
			el.appendChild(note_container);
		}
	}
}