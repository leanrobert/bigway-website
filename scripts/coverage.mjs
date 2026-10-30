// Converts the Google Earth coverage files (KML/KMZ) into the GeoJSON the site's map loads.
//
// Usage: pnpm coverage [inputDir] [outputFile]
//   inputDir   defaults to data/coverage
//   outputFile defaults to src/data/coverage.json
//
// Only polygons are kept: points and lines (NAPs, nodes, fiber routes) are dropped so network
// infrastructure never ends up on the public site. Descriptions and extended data are dropped too.
//
// Each zone is tagged "fibra" or "wireless" from its placemark name, then the "Carpeta"/"Origen"
// extended data that merged maps keep from their source layer, then its file name
// (e.g. "fibra-guaymallen.kmz", "Zona norte wireless"). Unclassified zones abort the run.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { kml } from '@tmcw/togeojson';
import { strFromU8, unzipSync } from 'fflate';

const [inputDir = 'data/coverage', outputFile = 'src/data/coverage.json'] = process.argv.slice(2);

/** ~1 m precision is plenty for a coverage map and keeps the file small. */
const round = (value) => Math.round(value * 1e5) / 1e5;
const roundCoords = (coords) => (typeof coords[0] === 'number' ? coords.slice(0, 2).map(round) : coords.map(roundCoords));

/** First of the given texts that names a technology wins, so the placemark beats the file. */
function detectTechnology(...texts) {
	for (const text of texts) {
		const value = (text ?? '').toLowerCase();
		if (/wireless|inal[aá]mbric/.test(value)) return 'wireless';
		if (/fibra|ftth/.test(value)) return 'fibra';
	}
	return null;
}

function readKml(file) {
	if (extname(file).toLowerCase() === '.kml') return readFileSync(file, 'utf8');
	// A KMZ is a zip whose main document is the first .kml inside it.
	const entries = unzipSync(readFileSync(file));
	const main = Object.keys(entries).find((name) => name.toLowerCase().endsWith('.kml'));
	if (!main) throw new Error(`${file}: no .kml inside the KMZ`);
	return strFromU8(entries[main]);
}

const files = readdirSync(inputDir)
	.filter((name) => /\.km[lz]$/i.test(name))
	.map((name) => join(inputDir, name));

if (files.length === 0) {
	console.error(`No .kml/.kmz files found in ${inputDir}`);
	process.exit(1);
}

const features = [];
const skipped = {};
const unclassified = [];

/** A placemark with several polygons (KML MultiGeometry) comes out as a GeometryCollection. */
function toPolygonGeometry(geometry) {
	if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') return geometry;
	const parts = geometry?.type === 'GeometryCollection' ? geometry.geometries : [];
	if (parts.length === 0 || parts.some((part) => part.type !== 'Polygon')) return null;
	return { type: 'MultiPolygon', coordinates: parts.map((part) => part.coordinates) };
}

for (const file of files) {
	const geojson = kml(new DOMParser().parseFromString(readKml(file), 'text/xml'));
	for (const feature of geojson.features) {
		const geometry = toPolygonGeometry(feature.geometry);
		if (!geometry) {
			const type = feature.geometry?.type ?? 'sin geometría';
			skipped[type] = (skipped[type] ?? 0) + 1;
			continue;
		}
		const props = feature.properties ?? {};
		const name = props.name ?? basename(file, extname(file));
		const technology = detectTechnology(props.name, props.Carpeta, props.Origen, basename(file));
		if (!technology) {
			unclassified.push(`${basename(file)} → ${name}`);
			continue;
		}
		features.push({
			type: 'Feature',
			properties: { name, technology },
			geometry: { type: geometry.type, coordinates: roundCoords(geometry.coordinates) },
		});
	}
}

if (unclassified.length) {
	console.error('These zones don\'t say whether they are fibra or wireless (rename the zone or the file):');
	for (const zone of unclassified) console.error(`  - ${zone}`);
	process.exit(1);
}

writeFileSync(outputFile, JSON.stringify({ type: 'FeatureCollection', features }) + '\n');

const count = (technology) => features.filter((f) => f.properties.technology === technology).length;
console.log(
	`${features.length} polygons (${count('fibra')} fibra, ${count('wireless')} wireless) from ${files.length} file(s) → ${outputFile}`,
);
for (const [type, count] of Object.entries(skipped)) {
	console.warn(`Skipped ${count} ${type} feature(s): only polygons are published.`);
}
