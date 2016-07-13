var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants");

// ---------------------
// Settings
// ---------------------


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_vod_chat = function() {
    // Get the VOD Chat Service
    var f = this,
        VODService = utils.ember_lookup('service:vod-chat-service');

    if ( VODService )
        VODService.reopen({
            messageBufferSize: f.settings.scrollback_length,

            pushMessage: function(msg) {
                if ( msg.get("color") === null ) {
                    var colors = this.get("colorSettings"),
                        from = msg.get("from");

                    if ( ! colors.get(from) )
                        colors.set(from, constants.CHAT_COLORS[Math.floor(Math.random() * constants.CHAT_COLORS.length)]);

                    msg.set("color", colors.get(from));
                }

                this.get("messages").pushObject(msg);

                var messages = this.get("messages"),
                    len = this.get("messages.length"),
                    limit = this.get("messageBufferSize");

                if ( len > limit )
                    messages.removeAt(0, len - limit);
            }
        });
    else
        f.error("Unable to locate VOD Chat Service.");

    this.update_views('component:vod-right-column', this.modify_vod_right_column);
    this.update_views('view:vod', this.modify_vod_view);
    this.update_views('component:vod-chat-display', this.modify_vod_chat_display);
}


FFZ.prototype.modify_vod_view = function(view) {
    var f = this;
    utils.ember_reopen_view(view, {
        ffz_init: function() {
            f._vodv = this;

            var channel_id = this.get('context.channel.name');

            if ( f.settings.auto_theater ) {
				var player = f.players && f.players[channel_id] && f.players[channel_id].get('player');
				if ( player )
					player.setTheatre(true);
			}

            // Listen to scrolling.
			this._ffz_scroller = this.ffzOnScroll.bind(this);
			jQuery(this.get('element')).parents('.tse-scroll-content').on('scroll', this._ffz_scroller);
        },

        ffz_destroy: function() {
            if ( f._vodv === this )
                f._vodv = null;

            if ( this._ffz_scroller ) {
				jQuery(this.get('element')).parents('.tse-scroll-content').off('scroll', this._ffz_scroller);
				this._ffz_scroller = null;
			}
        },

        ffzOnScroll: function(event) {
			// When we scroll past the bottom of the player, do stuff!
			var top = event && event.target && event.target.scrollTop,
				height = this.get('layout.playerSize.1');

            if ( ! top )
                top = jQuery(this.get('element')).parents('.tse-scroll-content').scrollTop();

			document.body.classList.toggle('ffz-small-player', f.settings.small_player && top >= height);
		}
    });
}


FFZ.prototype.modify_vod_right_column = function(component) {
    var f = this;
    utils.ember_reopen_view(component, {
        ffz_init: function() {
            if ( f.settings.dark_twitch ) {
                var el = this.get('element'),
                    cont = el && el.querySelector('.chat-container');

                if ( cont )
                    cont.classList.add('dark');
            }
        }
    });
}


FFZ.prototype.modify_vod_chat_display = function(component) {
    var f = this,
        VODService = utils.ember_lookup('service:vod-chat-service');

    utils.ember_reopen_view(component, {
        _prepareToolTips: function() {
            this.$(".tooltip").tipsy({
                live: true,
                gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 's')
            })
        },

        ffz_init: function() {
            f._vodc = this;

            // Load the room, if necessary
            var room_id = this.get('video.channel.name');
            if ( room_id && ! f.rooms[room_id] )
                f.load_room(room_id); // TODO: Function to reprocess existing messages.

            this.ffz_frozen = false;
            if ( f.settings.chat_hover_pause )
                this.ffzEnableFreeze();
        },

        ffz_destroy: function() {
            if ( f._vodc === this )
                f._vodc = undefined;

            // TODO: Function to unload the old room?

            this.ffzDisableFreeze();
        },

        ffzEnableFreeze: function() {
            var scroller = this.get('chatMessagesScroller');
            if ( ! scroller )
                return;

            this._ffz_interval = setInterval(this.ffzPulse.bind(this), 200);

            this._ffz_mouse_move = this.ffzMouseMove.bind(this);
            this._ffz_mouse_out = this.ffzMouseOut.bind(this);

            scroller.on('mousemove', this._ffz_mouse_move);
            scroller.on('touchmove', this._ffz_mouse_move);
            scroller.on('mouseout', this._ffz_mouse_out);
        },

        ffzDisableFreeze: function() {
            if ( this._ffz_interval ) {
                clearInterval(this._ffz_interval);
                this._ffz_interval = undefined;
            }

            this.ffzUnfreeze();
            var scroller = this.get('chatMessagesScroller');
            if ( ! scroller )
                return;

            if ( this._ffz_mouse_move ) {
                scroller.off('mousemove', this._ffz_mouse_move);
                scroller.off('touchmove', this._ffz_mouse_move);
                this._ffz_mouse_move = undefined;
            }

            if ( this._ffz_mouse_out ) {
                scroller.off('mouseout', this._ffz_mouse_out);
                this._ffz_mouse_out = undefined;
            }
        },

        ffzUnfreeze: function(from_stuck) {
            this.ffz_frozen = false;
            this._ffz_last_move = 0;
            this.ffzUnwarnPaused();

            if ( ! from_stuck && this.get('stuckToBottom') )
                this._scrollToBottom();
        },

        ffzPulse: function() {
            if ( this.ffz_frozen ) {
                var elapsed = Date.now() - this._ffz_last_move;
                if ( elapsed > 750 )
                    this.ffzUnfreeze();
            }
        },

        ffzMouseOut: function(event) {
            this._ffz_outside = true;
            var e = this;
            setTimeout(function() {
                if ( e._ffz_outside )
                    e.ffzUnfreeze();
            }, 25);
        },

        ffzMouseMove: function(event) {
            this._ffz_last_move = Date.now();
            this._ffz_outside = false;

            if ( event.screenX === this._ffz_last_screenx && event.screenY === this._ffz_last_screeny )
				return;

			this._ffz_last_screenx = event.screenX;
			this._ffz_last_screeny = event.screenY;

			if ( this.ffz_frozen )
				return;

			this.ffz_frozen = true;
			if ( this.get('stuckToBottom') ) {
                VODService && VODService.set("messageBufferSize", f.settings.scrollback_length + 150);
				this.ffzWarnPaused();
            }
        },

        _scrollToBottom: _.throttle(function() {
            var e = this,
                scroller = e.get('chatMessagesScroller');

            if ( ! scroller || ! scroller.length )
                return;

            Ember.run.next(function() {
                (window.requestAnimationFrame||setTimeout)(function() {
                    if ( e.ffz_frozen )
                        return;

                    scroller[0].scrollTop = scroller[0].scrollHeight;
                    e._setStuckToBottom(true);
                })
            })
        }, 300),

        _setStuckToBottom: function(val) {
            this.set("stuckToBottom", val);
            VODService && VODService.set("messageBufferSize", f.settings.scrollback_length + (val ? 0 : 150));
            if ( ! val )
                this.ffUnfreeze(true);
        },

        ffzWarnPaused: function() {
			var el = this.get('element'),
				warning = el && el.querySelector('.chat-interface .more-messages-indicator.ffz-freeze-indicator');

			if ( ! el )
				return;

			if ( ! warning ) {
				warning = document.createElement('div');
				warning.className = 'more-messages-indicator ffz-freeze-indicator';
				warning.innerHTML = '(Chat Paused Due to Mouse Movement)';

				var cont = el.querySelector('.chat-interface');
				if ( ! cont )
					return;
				cont.insertBefore(warning, cont.childNodes[0])
			}

			warning.classList.remove('hidden');
		},

		ffzUnwarnPaused: function() {
			var el = this.get('element'),
				warning = el && el.querySelector('.chat-interface .more-messages-indicator.ffz-freeze-indicator');

			if ( warning )
				warning.classList.add('hidden');
		}
    });
}