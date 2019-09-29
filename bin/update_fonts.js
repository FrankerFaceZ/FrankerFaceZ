'use strict';

const fs = require('fs');
const path = require('path');

const dir = 'styles/fontello';

for(const file of fs.readdirSync(dir)) {
	if ( file.endsWith('.css') ) {
		const old_path = path.join(dir, file),
			new_path = `${old_path.substr(0, old_path.length - 4)}.scss`;

		fs.renameSync(old_path, new_path);
	}
}

const config = JSON.parse(fs.readFileSync('fontello.config.json', 'utf8'));
const icons = config.glyphs.map(x => x.css);

fs.writeFileSync('src/utilities/ffz-icons.js', `'use strict';
// This is a generated file. To update it, please run: npm run font:update
/* eslint quotes: 0 */

export default ${JSON.stringify(icons, null, '\t')};`);
