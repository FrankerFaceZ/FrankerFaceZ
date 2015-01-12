FrankerFaceZ
============

Copyright (c) 2015 FrankerFaceZ

This script is free to modify for personal use. You are not allowed to sell or
distribute FrankerFaceZ or any components of FrankerFaceZ.


Developing
==========

FrankerFaceZ uses node.js to manage development dependencies and to run an HTTP
server for development. To get everything you need:

1. Install node.js
2. Run ```npm install``` within the FrankerFaceZ directory.


From there, you can use gulp to build the extension from source:

```
gulp
```

Gulp can also watch source files for modifications and rebuild it immediately:

```
gulp watch
```


To start the development server, run ```npm test```. The development server listens
on port 8000.


You will also need to use the version of the Chrome extension included in the
repository. Remove any existing copy of FrankerFaceZ from your browser and load
the unpacked extension in the ```Chrome Extension``` folder.

Once you're using that extension, use the command ```/ffz debug``` in Twitch chat
to enable debug mode, and then refresh the page. If the current version of FFZ
does not support the debug command, then open the JavaScript console on twitch.tv
and run:

```
localStorage.ffzDebugMode = true;
```

Refresh the page once debug mode is enabled to use the local version of the script.