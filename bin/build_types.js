const fs = require('fs');
const glob = require('glob');
const nativepath = require('path');
const pospath = nativepath.posix;

const PACKAGE = require('../package.json');

const manifest = {
	private: true,
	name: '@ffz/client-types',
	description: "TypeScript definitions for FrankerFaceZ",
	version: PACKAGE.version,
	types: "main",
	projects: [
		'https://www.frankerfacez.com'
	],
	repository: PACKAGE.repository,
	dependencies: {
		'@types/webpack-env': '^1.18.4'
	}
};

fs.writeFileSync('typedist/package.json', JSON.stringify(manifest, null, 4));

// Now, fix all the import paths.

const MATCHER = /from '([^']+)';$/gm,
	MATCH_TWO = /\bimport\("([^"]+)"\)/gm;

function shouldReplace(module) {
	return module.startsWith('utilities/');
}

for(const filename of glob.sync('typedist/**/*.d.ts')) {
	const folder = pospath.dirname(filename.split(nativepath.sep).join(pospath.sep));
	console.log('thing', filename, '-->', folder);

	let content = fs.readFileSync(filename, 'utf8');
	let changed = false;

	content = content.replace(MATCHER, (match, spec, index) => {
		if ( shouldReplace(spec) ) {
			//const modpath = pospath.dirname(`typedist/${spec}`);
			let relative = pospath.relative(folder, 'typedist');

				if ( relative === '' )
					relative = '.';

				if ( ! relative.endsWith('/') )
					relative += '/';

			console.log('  to', spec, '->', JSON.stringify(relative));

			changed = true;
			return `from '${relative}${spec}';`;
		}

		return match;
	});

	content = content.replace(MATCH_TWO, (match, spec, index) => {
		if ( shouldReplace(spec) ) {
			//const modpath = pospath.dirname(`typedist/${spec}`);
			let relative = pospath.relative(folder, 'typedist');

			if ( relative === '' )
				relative = '.';

			if ( ! relative.endsWith('/') )
				relative += '/';

			changed = true;
			return `import("${relative}${spec}")`;
		}

		return match;
	});

	if ( changed )
		fs.writeFileSync(filename, content);

}
