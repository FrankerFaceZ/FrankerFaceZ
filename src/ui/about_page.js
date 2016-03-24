var FFZ = window.FrankerFaceZ,
	constants = require("../constants"),
    utils = require("../utils"),
    createElement = document.createElement.bind(document),

    NICE_DESCRIPTION = {
        "cluster": null,
        "manifest_cluster": null,
        "user_ip": null
    };


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

var include_html = function(heading_text, filename) {
        return function(view, container) {
            var heading = createElement('div');
            heading.className = 'chat-menu-content center';
            heading.innerHTML = '<h1>FrankerFaceZ</h1>' + (heading_text ? '<div class="ffz-about-subheading">' + heading_text + '</div>' : '');

            jQuery.ajax(filename, {cache: false, context: this})
                .done(function(data) {
                    container.appendChild(heading);
                    container.innerHTML += data;

                    jQuery('#ffz-old-news-button', container).on('click', function() {
                        jQuery(this).remove();
                        jQuery('#ffz-old-news', container).css('display', 'block');
                    });

                }).fail(function(data) {
                    var content = createElement('div');
                    content.className = 'chat-menu-content menu-side-padding';
                    content.textContent = 'There was an error loading this page from the server.';

                    container.appendChild(heading);
                    container.appendChild(content);
                });
        }
    },
    render_news = include_html("news", constants.SERVER + "script/news.html");


var update_player_stats = function(player, container) {
    if ( ! document.querySelector('.ffz-ui-sub-menu-page[data-page="debugging"]') || ! player.getVideoInfo )
        return;

    setTimeout(update_player_stats.bind(this, player, container), 1000);

    var player_data;

    try {
        player_data = player.getVideoInfo();
    } catch(err) { }

    if ( ! player_data )
        return;

    var sorted_keys = Object.keys(player_data).sort();
    for(var i=0; i < sorted_keys.length; i++) {
        var key = sorted_keys[i],
            data = player_data[key],
            line = container.querySelector('li[data-property="' + key + '"]');

        if ( ! line ) {
            var desc = NICE_DESCRIPTION.hasOwnProperty(key) ? NICE_DESCRIPTION[key] : key;
            if ( ! desc )
                continue;

            line = createElement('li');
            line.setAttribute('data-property', key);
            line.innerHTML = desc + '<span></span>';
            container.appendChild(line);
        }

        line.querySelector('span').textContent = data;
    }
};


FFZ.menu_pages.about = {
    name: "About",
    icon: constants.HEART,
    sort_order: 100000,

    pages: {
        about: {
            name: "About",
            render: function(view, container, inner, menu) {
                var room = this.rooms[view.get("context.currentRoom.id")],
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
                var btn_container = createElement('div'),
                    ad_button = createElement('a'),
                    news_button = createElement('a'),
                    donate_button = createElement('a'),
                    message = "To use custom emoticons in " + (has_emotes ? "this channel" : "tons of channels") + ", get FrankerFaceZ from https://www.frankerfacez.com";


                // Advertising

                ad_button.className = 'button primary';
                ad_button.innerHTML = "Advertise in Chat";
                ad_button.addEventListener('click', this._add_emote.bind(this, view, message));

                btn_container.appendChild(ad_button);

                // Donate

                donate_button.className = 'button ffz-donate';
                donate_button.href = "https://www.frankerfacez.com/donate";
                donate_button.target = "_new";
                donate_button.innerHTML = "Donate";

                btn_container.appendChild(donate_button);
                btn_container.className = 'chat-menu-content center';
                container.appendChild(btn_container);


                // Credits
                var credits = createElement('div');

                content = '<table class="ffz-about-table">';
                content += '<tr><th colspan="4">Developers</th></tr>';
                content += '<tr><td>Dan Salvato</td><td><a class="twitch" href="//www.twitch.tv/dansalvato" title="Twitch" target="_new">&nbsp;</a></td><td><a class="twitter" href="https://twitter.com/dansalvato1" title="Twitter" target="_new">&nbsp;</a></td><td><a class="youtube" href="https://www.youtube.com/user/dansalvato1" title="YouTube" target="_new">&nbsp;</a></td></tr>';
                content += '<tr><td>Stendec</td><td><a class="twitch" href="//www.twitch.tv/sirstendec" title="Twitch" target="_new">&nbsp;</a></td><td><a class="twitter" href="https://twitter.com/SirStendec" title="Twitter" target="_new">&nbsp;</a></td><td><a class="youtube" href="https://www.youtube.com/channel/UCnxuvmK1DCPCXSJ-mXIh4KQ" title="YouTube" target="_new">&nbsp;</a></td></tr>';

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
                    f._pastebin(f._log_data.join("\n"), function(url) {
                        getting_logs = false;
                        if ( ! url )
                            alert("There was an error uploading the FrankerFaceZ logs.");
                        else
                            prompt("Your FrankerFaceZ logs have been uploaded to the URL:", url);
                    });
                });

                container.appendChild(credits);
            }
        },

        changelog: {
            name: "Changelog",
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
            name: "Credits",
            wide: true,
            render: include_html("credits", constants.SERVER + "script/credits.html")
        },

        debugging: {
            name: "Debug",
            wide: true,
            render: function(view, container) {
                // Heading
                var heading = createElement('div'),

                    info_head = createElement('div'),
                    info = createElement('ul'),
                    info_list = [
                        ['Client ID', localStorage.ffzClientId || '<i>not set</i>'],
                        ['Socket Server', this._ws_sock && this._ws_sock.url || '<i>disconnected</i>' ],
                        ['Server Ping', this._ws_last_ping || '<i>unknown</i>'],
                        ['Time Offset', this._ws_sock && this._ws_server_offset && (this._ws_server_offset < 0 ? "-" : "") + utils.time_to_string(Math.abs(this._ws_server_offset) / 1000) || '<i>unknown</i>']
                    ],

                    twitch_head = createElement('div'),
                    twitch = createElement('ul'),
                    twitch_list = [
                        ['Deploy Flavor', SiteOptions.deploy_flavor]
                    ],

                    player_head = createElement('div'),
                    player_list = createElement('ul'),

                    player, player_data,

                    ver_head = createElement('div'),
                    vers = createElement('ul'),
                    version_list = [
                            ['Ember', Ember.VERSION],
                            ['GIT Version', EmberENV.GIT_VERSION],
                            null,
                            ['FrankerFaceZ', FFZ.version_info.toString()]
                        ],

                    log_head = createElement('div'),
                    logs = createElement('pre');

                for(var pkey in this.players) {
                    player = this.players[pkey] && this.players[pkey].player;
                    if ( player )
                        break;
                }

                if ( player ) {
                    try {
                        player_data = player.getVideoInfo();
                    } catch(err) { }
                }

                heading.className = 'chat-menu-content center';
                heading.innerHTML = '<h1>FrankerFaceZ</h1><div class="ffz-about-subheading">woofs for nerds</div>';

                info_head.className = twitch_head.className = player_head.className = ver_head.className = log_head.className = 'list-header';
                info.className = twitch.className = player_list.className = vers.className = 'chat-menu-content menu-side-padding version-list';


                info_head.innerHTML = 'Client Status';

                for(var i=0; i < info_list.length; i++) {
                    var data = info_list[i],
                        line = createElement('li');
                    line.innerHTML = data === null ? '<br>' : data[0] + '<span>' + data[1] + '</span>';
                    info.appendChild(line);
                }


                twitch_head.innerHTML = 'Twitch Configuration';

                // Check for Twitch geo-location
                var user = this.get_user();
                if ( user && user.login ) {
                    twitch_list.push(["Current User", user.login + " [" + user.id + "]"]);
                    var us = [];

                    user.is_staff && us.push("staff");
                    user.is_admin && us.push("admin");
                    user.is_partner && us.push("partner");
                    user.is_broadcaster && us.push("broadcaster");
                    user.has_turbo && us.push("turbo");

                    twitch_list.push(["User State", us.join(", ") || "<i>none</i>"]);

                } else
                    twitch_list.push(["Current User", "<i>not logged in</i>"]);

                if ( window.Twitch && Twitch.geo && Twitch.geo._result ) {
                    var data = Twitch.geo._result;
                    if ( data.geo )
                        twitch_list.push(["Region", data.geo + (data.eu ? " [EU]" : "")]);

                    if ( data.received_language )
                        twitch_list.push(["Received Language", data.received_language])
                }

                for(var i=0; i < twitch_list.length; i++) {
                    var data = twitch_list[i],
                        line = createElement('li');
                    line.innerHTML = data === null ? '<br>' : data[0] + '<span>' + data[1] + '</span>';
                    twitch.appendChild(line);
                }


                if ( player_data ) {
                    player_head.innerHTML = "Player Statistics";
                    update_player_stats(player, player_list);
                }


                ver_head.innerHTML = 'Versions';

                if ( this.has_bttv )
                    version_list.push(["BetterTTV", BetterTTV.info.version + 'r' + BetterTTV.info.release]);

                if ( Object.keys(this._apis).length ) {
                    version_list.push(null);
                    for(var key in this._apis) {
                        var api = this._apis[key];
                        version_list.push(['<b>Ext #' + api.id + '.</b> ' + api.name, api.version || '<i>unknown</i>']);
                    }
                }

                for(var i=0; i < version_list.length; i++) {
                    var data = version_list[i],
                        line = createElement('li');
                    line.innerHTML = data === null ? '<br>' : data[0] + '<span>' + data[1] + '</span>';
                    vers.appendChild(line);
                }

                log_head.className = 'list-header';
                log_head.innerHTML = 'Logs';

                logs.className = 'chat-menu-content menu-side-padding';
                logs.textContent = this._log_data.join("\n");

                container.appendChild(heading);

                container.appendChild(ver_head);
                container.appendChild(vers);

                container.appendChild(info_head);
                container.appendChild(info);

                container.appendChild(twitch_head);
                container.appendChild(twitch);

                if ( player_data ) {
                    container.appendChild(player_head);
                    container.appendChild(player_list);
                }

                container.appendChild(log_head);
                container.appendChild(logs);
            }
        }
    }
}