var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),

	createElement = utils.createElement;


// -------------------
// Settings
// -------------------

FFZ.settings_info.dashboard_feed = {
	type: "boolean",
	value: true,

	no_mobile: true,
	//no_bttv: true,

	category: "Dashboard",
	name: "Channel Feed <small>(Requires Refresh)</small>",
	help: "Add a way to post to your channel feed directly to the dashboard!"
}


// -------------------
// Initialization
// -------------------

FFZ.prototype.setup_dash_feed = function() {
	var f = this,
		user = this.get_user(),
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard && match && match[1];

	if ( /*this.has_bttv ||*/ ! this.settings.dashboard_feed || ! user || ! id || id !== user.login )
		return;

	utils.api.get("feed/" + id + "/posts", {limit: 1}, {version: 3}).done(function(data) {
		// If this works, then the feed is enabled. Show the UI.
		/*if ( ! f.has_bttv )*/
			f.build_dash_feed();
	})
}


FFZ.prototype._remove_dash_feed = function() {
	var tabs = document.querySelector('#ffz-feed-tabs'),
		parent = tabs && tabs.parentElement,
		tab_status = document.querySelector('div.dash-broadcast-contain');

	if ( ! tabs || ! parent )
		return;

	if ( tab_status && tabs.contains(tab_status) ) {
		tabs.removeChild(tab_status);
		parent.insertBefore(tab_status, tabs);
	}

	parent.removeChild(tabs);
}


FFZ.prototype.build_dash_feed = function() {
	var f = this,
		user = this.get_user(),

		tabs = createElement('div'),
		tab_bar = createElement('ul', 'tabs'),

		nav_status = createElement('li', 'tab', '<a id="ffz-nav-status">Broadcast Status</a>'),
		nav_feed = createElement('li', 'tab', '<a id="ffz-nav-feed">Channel Feed</a>'),

		tab_status = document.querySelector('div.dash-broadcast-contain'),
		tab_feed = createElement('div', 'dash-broadcast-contain dash-ffz-feed-contain hidden'),

		txt_input = createElement('textarea', 'ffz-feed-entry'),
		char_count = createElement('span', 'char-count', '0');
		align_btn = createElement('div', 'ffz-feed-button clearfix'),
		chk_share = createElement('span', null, '<input type="checkbox"> Share to Twitter'),
		checkbox = chk_share.querySelector('input'),
		btn_submit = createElement('button', 'button primary', '<span>Post</span>'),

		column = tab_status && tab_status.parentElement,
		placeholder = 'Post an update to your channel...';

	if ( ! tab_status || ! column || ! user )
		return;

	tab_feed.appendChild(txt_input);
	tab_feed.appendChild(align_btn);

	if ( user.twitter_connected )
		align_btn.appendChild(chk_share);
	else {
		var tnc = createElement('span', null, '<i>(Twitter Not Connected)</i>');
		tnc.title = 'Click to Refresh';
		tnc.style.cursor = 'pointer';
		tnc.addEventListener('click', function() {
			user = f.get_user();
			if ( user.twitter_connected ) {
				jQuery(tnc).trigger('mouseout');
				align_btn.removeChild(tnc);
				align_btn.insertBefore(chk_share, align_btn.firstChild);
			}
		});
		jQuery(tnc).tipsy();
		align_btn.appendChild(tnc);
	}

	char_count.title = 'Roughly the first 115 characters of a post will appear in a Tweet.';
	jQuery(char_count).tipsy();

	align_btn.appendChild(btn_submit);
	align_btn.appendChild(char_count);

	txt_input.id = 'vod_status';
	txt_input.placeholder = placeholder;

	var updater = function() {
		var share = user.twitter_connected && checkbox && checkbox.checked || false,
			len = txt_input.value.length;

		char_count.innerHTML = share ? utils.number_commas(115 - len) + '<span>+</span>' : utils.number_commas(len);
		char_count.classList.toggle('over-limit', share && 115-len < 0 || false);

		if ( len === 0 )
			txt_input.placeholder = placeholder;
	}

	checkbox.addEventListener('change', updater);
	txt_input.addEventListener('input', updater);

	btn_submit.addEventListener('click', function() {
		var match = f.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
			id = f.is_dashboard && match && match[1];

		if ( ! id || this.disabled )
			return;

		var share = user.twitter_connected && checkbox && checkbox.checked || false,
			body = txt_input.value;

		txt_input.disabled = true;
		btn_submit.disabled = true;

		utils.api.post("feed/" + id + "/posts?share=" + JSON.stringify(share), {content: body, share: share}).done(function(data) {
			txt_input.disabled = false;
			btn_submit.disabled = false;

			txt_input.value = '';

			var tweeted = data.tweet ? " The update was tweeted out." : (share ? " There was a problem tweeting the update." : "");
			txt_input.placeholder = 'The update was posted successfully.' + tweeted + ' Post another update to your channel...';
			f.log("Channel Feed Posting Succeeded", data);

		}).fail(function(data) {
			txt_input.disabled = false;
			btn_submit.disabled = false;

			data = data ? data.data || data.responseJSON || undefined : undefined;
			f.log("Channel Feed Posting Failed", data);
			alert("An error occured posting to your channel feed:\n\n" + (data && data.message || "Unknown Error"));

		});
	});

	var switch_tab = function(e) {
		var to = this.getAttribute('data-nav');
		jQuery('.selected', tab_bar).removeClass('selected');
		this.classList.add('selected');

		jQuery('.active-tab', tabs).removeClass('active-tab').addClass('hidden');
		jQuery('div[data-tab="' + to + '"]', tabs).addClass('active-tab').removeClass('hidden');
	}

	tabs.id = 'ffz-feed-tabs';

	nav_status.setAttribute('data-nav', 'status');
	nav_feed.setAttribute('data-nav', 'feed');

	nav_status.addEventListener('click', switch_tab);
	nav_feed.addEventListener('click', switch_tab);

	tab_status.setAttribute('data-tab', 'status');
	tab_feed.setAttribute('data-tab', 'feed');

	column.removeChild(tab_status);

	tab_bar.appendChild(nav_status);
	tab_bar.appendChild(nav_feed);

	tabs.appendChild(tab_bar);
	tabs.appendChild(tab_status);
	tabs.appendChild(tab_feed);

	column.insertBefore(tabs, column.firstChild);
	switch_tab.call(nav_status);
}