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

fs.writeFileSync('src/utilities/ffz-icons.ts', `'use strict';
// This is a generated file. To update it, please run: pnpm font:update
/* eslint quotes: 0 */

/**
 * A list of all valid icon names in the FrankerFaceZ icon font. These
 * icons can be used by adding a class to a DOM element with the name
 * \`ffz-i-$\{name}\` where \`$\{name}\` is a name from this list.
 *
 * For example, to use the \`threads\` icon, you'd add the class
 * \`ffz-i-threads\` to your element.
 */
export default ${JSON.stringify(icons, null, '\t')} as const;`);
