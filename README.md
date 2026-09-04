FrankerFaceZ
============

[![Build Main Client](https://github.com/FrankerFaceZ/FrankerFaceZ/actions/workflows/build.yml/badge.svg)](https://github.com/FrankerFaceZ/FrankerFaceZ/actions/workflows/build.yml)
[![Build Extension](https://github.com/FrankerFaceZ/Extension/actions/workflows/build-extension.yml/badge.svg)](https://github.com/FrankerFaceZ/Extension/actions/workflows/build-extension.yml)

Copyright (c) 2024 Dan Salvato LLC

Licensed under the Apache License, Version 2.0. See LICENSE.


Developing
==========

FrankerFaceZ uses [Bun](https://bun.sh/) as its JavaScript runtime and package
manager, both to manage development dependencies and to run an HTTP server for
development. The version to use is pinned in `.bun-version`. To get everything
you need:

1. Install [Bun](https://bun.sh/)
2. Run `bun install` within the FrankerFaceZ directory.


From there, you can build FrankerFaceZ from source simply by running
`bun run build`. For development, you can instruct Rspack to watch the source
files for changes and re-build automatically with `bun run start`

FrankerFaceZ comes with a local development server that listens on port 8000
and it serves up local development copies of files, falling back to the CDN
when a local copy of a file isn't present.

> **Note:** The local development server uses Rspack's dev server internally,
> which self-signs a certificate for hosting content via HTTPS. You will need
> to ensure your browser accepts a self-signed certificate for localhost.

The user-script version of FrankerFaceZ is designed to make it easy to load
from your local development server. Please switch to using the user-script
version for development purposes.

Then, you must set the local storage variable `ffzDebugMode` to true.
Just run the following in your console on Twitch:
```javascript
localStorage.ffzDebugMode = true;
```

---

You can edit the project's icon font using the `bun run font` command. This will
create a new Fontello session, if one doesn't already exist, and open your
default web browser to Fontello so you can edit the font.

If you're running the development server with `bun run start`, you'll be able to
automatically save changes to the Fontello font by clicking Fontello's Export
button. Otherwise, you can use `bun run font:save` to download the changes
from your session.


Hosting Your Own Build
======================

The user-script loader and the compiled client both default to loading from
the FrankerFaceZ CDN. To build a client that loads from your own host instead,
set `FFZ_CLIENT_HOST` when building:

```bash
FFZ_CLIENT_HOST=https://ffz.example.com bun run build
```

This changes three things: the public path baked into every chunk URL, the
`CLIENT_SERVER` constant the client uses for its own data files, and the CDN
reference inside the copied loader script (`dist/script.min.js`). Everything
else is unchanged, so a build without the variable is identical to upstream's.

Your host needs to serve `dist/` over HTTPS with an
`Access-Control-Allow-Origin: *` header, laid out the way the loader expects:

- `/static/` holds every hashed file from `dist/` (chunks, styles, fonts, JSON).
  These names never change once published, so cache them for as long as you like.
- `/script/` holds the stable, unhashed names the loader and the client request:
  `avalon.js`, `clips.js`, `kick.js`, `player.js`, `bridge.js`,
  `esbridge.js`, `experiments.json`, `kick-rooms.json` and
  `sample-chat-messages.json`. `dist/manifest.json` maps
  each stable name to its current hashed file. Do not cache these for long.

To try a self-hosted build locally, `bun run serve:dist` serves `dist/` with
that layout on `https://localhost:8001`, using a self-signed certificate kept
in `~/.frankerfacez/serve-dist/` (created with openssl on first run, and left
alone by reinstalls; set `FFZ_SERVE_DIR` to move it). Build with
`FFZ_CLIENT_HOST=https://localhost:8001 bun run build`, open the loader URL the
server prints once to trust the certificate, and install `dist/script.min.js`
as a userscript. HTTPS matters: Firefox refuses plain-HTTP scripts injected
into twitch.tv.

To publish on a static host, lay the build out first:

```bash
FFZ_CLIENT_HOST=https://ffz.example.pages.dev bun run build
bun run layout:site
```

This writes `site/` with `static/` (every file), `script/` (copies under the
stable names) and a `_headers` file carrying the CORS and caching rules, so any
static host can serve it unchanged. The CI workflow runs the same layout and,
on pushes to `master`, deploys `site/` to Cloudflare Pages when the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets and the
`CLOUDFLARE_PAGES_PROJECT` variable are set. Set `FFZ_CLIENT_HOST` to the Pages
URL so the build loads from it, then install
`https://<your project>.pages.dev/script/script.min.js` as a userscript once;
every later merge updates what it loads.

Only the client itself comes from your host. Emoji images, Twitch badge art,
emote replacements, translations and add-ons are still loaded from the
FrankerFaceZ CDN (`SERVER` in `src/utilities/constants.ts`), and emote and
badge data still comes from the FrankerFaceZ API.

Kick
====

The client also has a `kick` flavor that runs on kick.com. It is early: it
loads the settings system, the FFZ Control Center (from a button in Kick's
top navigation), add-ons, tooltips and chat. Chat messages are run through
FFZ's tokenizers, so FFZ's emotes, emoji, links and mentions render in
Kick's chat alongside Kick's own emotes. The player is not touched yet.

FFZ's channel emotes belong to Twitch channels, and FFZ's backend does not
know Kick channels, so a Kick channel shows the emotes of the Twitch channel
with the same name. `src/sites/kick/kick-rooms.json`, served beside the
client as `kick-rooms.json`, overrides that per channel: each key is a Kick
channel slug and its value a Twitch login, or `null` to show no channel
emotes there. The whole behaviour can be turned off in the control center
under Chat > Emotes.

Appearance settings on Kick, all opt-out, give the site Twitch's darker
greys, tone Kick's green down a little, color usernames Twitch-style (with
FFZ's readability adjustment), set chat's font size and message spacing,
shrink badges, stripe alternate lines, show FFZ-formatted timestamps,
highlight lines that mention you, and hide the sidebar's recommended
channels, the Gift Subs button, the banners above chat, the "New messages"
divider, the row of emotes above the chat box and the counters below it.

The loader picks the flavor by hostname, the same way it picks the clips
and player flavors, and it is served as `kick.js` beside the other stable
names. The site module lives in `src/sites/kick`; its stylesheet carries
Twitch's design tokens and the `tw-*` utility classes the control center is
built with, since Kick's pages provide neither.

Editor Settings
===============

Please make sure that your editor is configured to use tabs rather than spaces
for indentation and that lines are ended with `\n`. It's recommended that you
configure linting support for your editor as well.

If you're using Visual Studio Code, make sure to install the ESLint extension
and add the following to your workspace settings:

```json
{
	"eslint.validate": [
		"javascript",
		"javascriptreact",
		"vue"
	]
}
```