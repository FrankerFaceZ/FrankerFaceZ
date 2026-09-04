import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HEADERS, STABLE_NAMES, layoutSite } from './layout-site.js';

let root, dist, site;

function write(name, content = name) {
	fs.writeFileSync(path.join(dist, name), content);
}

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'ffz-layout-'));
	dist = path.join(root, 'dist');
	site = path.join(root, 'site');
	fs.mkdirSync(dist);
});

afterEach(() => {
	fs.rmSync(root, {recursive: true, force: true});
});

describe('layoutSite', () => {
	it('refuses a directory without a manifest', () => {
		expect(() => layoutSite({dist, site})).toThrow(/No build found/);
	});

	it('copies every file under static and the stable names under script', () => {
		write('manifest.json', JSON.stringify({'avalon.js': 'avalon.abcd1234.js', 'experiments.json': 'experiments.json'}));
		write('avalon.abcd1234.js', 'client');
		write('experiments.json', '{}');
		write('script.min.js', 'loader');
		write('main.deadbeef.css', 'css');
		fs.mkdirSync(path.join(dist, 'nested'));

		const result = layoutSite({dist, site});

		expect(result.copied).toBe(5);
		expect(fs.readdirSync(path.join(site, 'static')).sort()).toEqual([
			'avalon.abcd1234.js', 'experiments.json', 'main.deadbeef.css', 'manifest.json', 'script.min.js'
		]);
		expect(fs.readFileSync(path.join(site, 'script', 'avalon.js'), 'utf8')).toBe('client');
		expect(fs.readFileSync(path.join(site, 'script', 'experiments.json'), 'utf8')).toBe('{}');
		expect(fs.readFileSync(path.join(site, 'script', 'script.min.js'), 'utf8')).toBe('loader');
		expect(result.stable).toEqual(['script.min.js', 'avalon.js', 'experiments.json']);
		expect(result.missing).toEqual(STABLE_NAMES.filter(n => ! result.stable.includes(n)));
	});

	it('uses the dev loader name when the minified one is absent', () => {
		write('manifest.json', '{}');
		write('script.js', 'dev loader');

		const result = layoutSite({dist, site});
		expect(result.stable).toContain('script.min.js');
		expect(fs.readFileSync(path.join(site, 'script', 'script.min.js'), 'utf8')).toBe('dev loader');
	});

	it('writes the headers file with CORS and the two cache policies', () => {
		write('manifest.json', '{}');
		layoutSite({dist, site});

		const headers = fs.readFileSync(path.join(site, '_headers'), 'utf8');
		expect(headers).toBe(HEADERS);
		expect(headers).toMatch(/\/\*\n\s+Access-Control-Allow-Origin: \*/);
		expect(headers).toMatch(/\/static\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
		expect(headers).toMatch(/\/script\/\*\n\s+Cache-Control: no-cache/);
	});

	it('empties a previous layout first', () => {
		write('manifest.json', '{}');
		fs.mkdirSync(path.join(site, 'static'), {recursive: true});
		fs.writeFileSync(path.join(site, 'static', 'stale.js'), 'old');

		layoutSite({dist, site});
		expect(fs.existsSync(path.join(site, 'static', 'stale.js'))).toBe(false);
	});
});
