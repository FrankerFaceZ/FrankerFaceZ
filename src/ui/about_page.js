var FFZ = window.FrankerFaceZ,
	constants = require("../constants");


// -------------------
// Initialization
// -------------------

FFZ.prototype._has_news = false;
FFZ.prototype._news_id = 0;

FFZ.prototype.check_news = function(tries) {
	jQuery.ajax(constants.SERVER + "script/news.json", {cache: false, dataType: "json", context: this})
		.done(function(data) {
			FFZ.ws_commands.update_news.bind(this)(data.id);
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
	if ( ! old_version || old_version === NaN || old_version < 0 )
		old_version = 0;

	if ( version <= old_version ) {
		this._news_id = old_version;
		return;
	}

	this._has_news = true;
	this._news_id = version;
	this.update_ui_link();
}


// -------------------
// About Page
// -------------------

FFZ.menu_pages.about_changelog = {
	name: "Changelog",
	visible: false,
	wide: true,

	render: function(view, container) {
		var heading = document.createElement('div');

		heading.className = 'chat-menu-content center';
		heading.innerHTML = '<h1>FrankerFaceZ</h1><div class="ffz-about-subheading">change log</div>';

		jQuery.ajax(constants.SERVER + "script/changelog.html", {cache: false, context: this})
			.done(function(data) {
				container.appendChild(heading);
				container.innerHTML += data;

			}).fail(function(data) {
				var content = document.createElement('div');
				content.className = 'chat-menu-content menu-side-padding';
				content.textContent = 'There was an error loading the change log from the server.';

				container.appendChild(heading);
				container.appendChild(content);
			});
	}
};


FFZ.menu_pages.about_news = {
	name: "News",
	visible: false,
	wide: true,

	render: function(view, container) {
		// Handle the news state.
		if ( this._has_news ) {
			this._has_news = false;
			localStorage.ffzLastNewsId = this._news_id;
			this.update_ui_link();
		}


		var heading = document.createElement('div');

		heading.className = 'chat-menu-content center';
		heading.innerHTML = '<h1>FrankerFaceZ</h1><div class="ffz-about-subheading">announcements and news</div>';

		jQuery.ajax(constants.SERVER + "script/news.html", {cache: false, context: this})
			.done(function(data) {
				container.appendChild(heading);
				container.innerHTML += data;

			}).fail(function(data) {
				var content = document.createElement('div');
				content.className = 'chat-menu-content menu-side-padding';
				content.textContent = 'There was an error loading the announcements from the server.';

				container.appendChild(heading);
				container.appendChild(content);
			});
	}
};


FFZ.menu_pages.about = {
	name: "About",
	icon: constants.HEART,
	sort_order: 100000,

	render: function(view, container, inner, menu) {
		var room = this.rooms[view.get("context.currentRoom.id")],
			has_emotes = false, f = this;

		// Check for emoticons.
		if ( room && room.set ) {
			var set = this.emote_sets[room.set];
			if ( set && set.count > 0 )
				has_emotes = true;
		}

		// Heading
		var heading = document.createElement('div'),
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
		var btn_container = document.createElement('div'),
			ad_button = document.createElement('a'),
			news_button = document.createElement('a'),
			donate_button = document.createElement('a'),
			message = "To use custom emoticons in " + (has_emotes ? "this channel" : "tons of channels") + ", get FrankerFaceZ from http://www.frankerfacez.com";


		// News
		/*news_button.className = 'button ffz-news';
		news_button.innerHTML = 'Announcements and News';
		news_button.addEventListener('click', function() {
			f._ui_change_page(view, inner, menu, container, 'about_news');
		});

		btn_container.appendChild(news_button);
		btn_container.className = 'chat-menu-content center';
		container.appendChild(btn_container);
		btn_container = document.createElement('div');*/


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
		var credits = document.createElement('div');

		content = '<table class="ffz-about-table">';
		content += '<tr><th colspan="4">Developers</th></tr>';
		content += '<tr><td>Dan Salvato</td><td><a class="twitch" href="http://www.twitch.tv/dansalvato" title="Twitch" target="_new">&nbsp;</a></td><td><a class="twitter" href="https://twitter.com/dansalvato1" title="Twitter" target="_new">&nbsp;</a></td><td><a class="youtube" href="https://www.youtube.com/user/dansalvato1" title="YouTube" target="_new">&nbsp;</a></td></tr>';
		content += '<tr><td>Stendec</td><td><a class="twitch" href="http://www.twitch.tv/sirstendec" title="Twitch" target="_new">&nbsp;</a></td><td><a class="twitter" href="https://twitter.com/SirStendec" title="Twitter" target="_new">&nbsp;</a></td><td><a class="youtube" href="https://www.youtube.com/channel/UCnxuvmK1DCPCXSJ-mXIh4KQ" title="YouTube" target="_new">&nbsp;</a></td></tr>';

		content += '<tr class="debug"><td><a href="#" id="ffz-changelog">Version ' + FFZ.version_info + '</a></td><td colspan="3"><a href="#" id="ffz-debug-logs">Logs</a></td></tr>';

		credits.className = 'chat-menu-content center';
		credits.innerHTML = content;

		// Functional Changelog
		credits.querySelector('#ffz-changelog').addEventListener('click', function() {
			f._ui_change_page(view, inner, menu, container, 'about_changelog');
		});

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
}