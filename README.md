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
2. Run ```npm install -g gulp``` to install the ```gulp``` command line utility.
3. Run ```npm install``` within the FrankerFaceZ directory.


From there, you can use gulp to build the extension from source simply by
running ```gulp```. For development, you can instruct gulp to watch the source
files for changes and re-build automatically with ```gulp watch```

FrankerFaceZ comes with a local development server that listens on port 8000
and it serves up local development copies of files, falling back to the CDN
when a local copy of a file isn't present. To start the server,
run ```gulp server```

For convenience, the server is run automatically along with ```gulp watch```


Use the command ```/ffz developer_mode on``` or ```/ffz developer_mode off```
in Twitch chat to toggle developer mode on or off. You must then refresh the
page for changes to take effect. If FFZ is not working or the command otherwise
fails to work, you can open the JavaScript console on twitch.tv and run
```localStorage.ffzDebugMode = true;``` or
```localStorage.ffzDebugMode = false;``` to enable or disable the feature.