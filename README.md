FrankerFaceZ
============

[![Build Main Client](https://github.com/FrankerFaceZ/FrankerFaceZ/actions/workflows/build.yml/badge.svg)](https://github.com/FrankerFaceZ/FrankerFaceZ/actions/workflows/build.yml)
[![Build Extension](https://github.com/FrankerFaceZ/Extension/actions/workflows/build-extension.yml/badge.svg)](https://github.com/FrankerFaceZ/Extension/actions/workflows/build-extension.yml)

Copyright (c) 2024 Dan Salvato LLC

Licensed under the Apache License, Version 2.0. See LICENSE.


Developing
==========

FrankerFaceZ uses node.js to manage development dependencies and to run an HTTP
server for development. This project uses the [pnpm](https://pnpm.io/) package
manager. To get everything you need:

1. Install node.js and [pnpm](https://pnpm.io/)
2. Run `pnpm install` within the FrankerFaceZ directory.


From there, you can use npm to build FrankerFaceZ from source simply by
running `pnpm build`. For development, you can instruct webpack to watch
the source files for changes and re-build automatically with `pnpm start`

FrankerFaceZ comes with a local development server that listens on port 8000
and it serves up local development copies of files, falling back to the CDN
when a local copy of a file isn't present.

> **Note:** The local development server uses `webpack-dev-server` internally,
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

You can edit the project's icon font using the `pnpm font` command. This will
create a new Fontello session, if one doesn't already exist, and open your
default web browser to Fontello so you can edit the font.

If you're running the development server with `pnpm start`, you'll be able to
automatically save changes to the Fontello font by clicking Fontello's Export
button. Otherwise, you can use `pnpm font:save` to download the changes
from your session.


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