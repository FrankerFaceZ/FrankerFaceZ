var FFZ = window.FrankerFaceZ,
	constants = require("../constants");


// -------------------
// About Page
// -------------------

FFZ.menu_pages.about = {
	name: "About",
	icon: constants.HEART,
	sort_order: 100000,

	render: function(view, container) {
		var room = this.rooms[view.get("context.currentRoom.id")],
			has_emotes = false, f = this;

		// Check for emoticons.
		if ( room && room.sets.length ) {
			for(var i=0; i < room.sets.length; i++) {
				var set = this.emote_sets[room.sets[i]];
				if ( set && set.count > 0 ) {
					has_emotes = true;
					break;
				}
			}
		}

		// Heading
		var heading = document.createElement('div'),
			content = '';

		content += "<h1>FrankerFaceZ</h1>";
		content += '<div class="ffz-about-subheading">new ways to woof</div>';

		heading.className = 'chat-menu-content center';
		heading.innerHTML = content;
		container.appendChild(heading);


		// Advertising
		var btn_container = document.createElement('div'),
			ad_button = document.createElement('a'),
			message = "To use custom emoticons in " + (has_emotes ? "this channel" : "tons of channels") + ", get FrankerFaceZ from http://www.frankerfacez.com";

		ad_button.className = 'button primary';
		ad_button.innerHTML = "Advertise in Chat";
		ad_button.addEventListener('click', this._add_emote.bind(this, view, message));

		btn_container.appendChild(ad_button);

		// Donate
		var donate_button = document.createElement('a');

		donate_button.className = 'button ffz-donate';
		donate_button.href = "http://www.frankerfacez.com/donate.html";
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

		content += '<tr class="debug"><td>Version ' + FFZ.version_info + '</td><td colspan="3"><a href="#" id="ffz-debug-logs">Logs</a></td></tr>';

		credits.className = 'chat-menu-content center';
		credits.innerHTML = content;

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