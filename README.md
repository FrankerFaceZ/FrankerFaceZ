FrankerFaceZ
============

Copyright (c) 2018 Dan Salvato LLC

Licensed under the Apache License, Version 2.0. See LICENSE.


Developing
==========

FrankerFaceZ uses node.js to manage development dependencies and to run an HTTP
server for development. To get everything you need:

1. Install node.js and npm
2. Run `npm install` within the FrankerFaceZ directory.


From there, you can use npm to build FrankerFaceZ from source simply by
running `npm run build`. For development, you can instruct gulp to watch
the source files for changes and re-build automatically with `npm start`

FrankerFaceZ comes with a local development server that listens on port 8000
and it serves up local development copies of files, falling back to the CDN
when a local copy of a file isn't present.

To make FrankerFaceZ load from your local development server, you must set
the local storage variable `ffzDebugMode` to true. Just run the following
in your console on Twitch: `localStorage.ffzDebugMode = true;`

It should be noted that this project is not a browser extension that you
would load in your browser's extensions system. You still need the FrankerFaceZ
extension or user-script for your browser.


Editor Settings
===============

Please make sure that your editor is configured to use tabs rather than spaces
for indentation and that lines are ended with `\n`. It's recommended that you
configure linting support for your editor as well.

If you're using Visual Studio Code, make sure to install the ESLint extension
and add the following to your workspace settings:

```
{
	"eslint.validate": [
		"javascript",
		"vue"
	]
}```