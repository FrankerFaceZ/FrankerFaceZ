var fs = require("fs"),
	http = require("http"),
	path = require("path"),
	request = require("request"),
	url = require("url");

http.createServer(function(req, res) {
	var uri = url.parse(req.url).pathname,
		lpath = path.join(uri).split(path.sep);

	if ( ! lpath[0] )
		lpath.shift();

	if ( lpath[0] == "script" )
		lpath.shift();
	else
		lpath.splice(0, 0, "cdn");

	var file = path.join(process.cwd(), lpath.join(path.sep));

	fs.exists(file, function(exists) {
		if ( ! exists ) {
			console.log("[CDN] GET " + uri);
			return request.get("http://cdn.frankerfacez.com/" + uri).pipe(res);
		}

		if ( fs.lstatSync(file).isDirectory() ) {
			console.log("[403] GET " + uri);
			res.writeHead(403);
			res.write('403 Forbidden');
			return res.end();
		}

		console.log("[200] GET " + uri);
		res.writeHead(200, {"Access-Control-Allow-Origin": "*"});
		fs.createReadStream(file).pipe(res);
	});

}).listen(8000);