import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	bboxOf,
	circle,
	clipToCircle,
	COVERAGE_RADIUS_M,
	coverageAround,
	positions,
	technologiesAt,
	type Position,
} from './coverage-geo.ts';

/** Axis-aligned square around a center, `half` degrees on each side. */
const square = ([lng, lat]: Position, half: number): Position[] => [
	[lng - half, lat - half],
	[lng + half, lat - half],
	[lng + half, lat + half],
	[lng - half, lat + half],
	[lng - half, lat - half],
];

/** Great-circle distance in meters, independent from the projection the module uses. */
function haversine([lng1, lat1]: Position, [lng2, lat2]: Position): number {
	const rad = Math.PI / 180;
	const a =
		Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
		Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
	return 2 * 6371008.8 * Math.asin(Math.sqrt(a));
}

/**
 * Shoelace area in squared degrees; enough to compare shapes at the same latitude. Coordinates
 * are taken relative to the first vertex, or float cancellation swamps an area this small.
 */
function area(ring: Position[]): number {
	const [ox, oy] = ring[0];
	const local = ring.map(([x, y]) => [x - ox, y - oy]);
	return Math.abs(local.slice(0, -1).reduce((sum, [x1, y1], i) => sum + x1 * local[i + 1][1] - local[i + 1][0] * y1, 0)) / 2;
}

// Somewhere in Godoy Cruz; 0.01° is roughly 1 km here, well beyond the 500 m radius.
const center: Position = [-68.85, -32.93];
const far: Position = [-68.5, -32.6];
const clip = circle(center, COVERAGE_RADIUS_M);

describe('technologiesAt', () => {
	it('lists the technologies whose zones contain the point', () => {
		const features = [
			{ properties: { technology: 'fibra' }, geometry: { type: 'Polygon', coordinates: [square(center, 0.01)] } },
			{ properties: { technology: 'wireless' }, geometry: { type: 'Polygon', coordinates: [square(far, 0.01)] } },
		];
		assert.deepEqual(technologiesAt(center, features), ['fibra']);
	});
});

describe('circle', () => {
	it('puts every vertex 500 m (±1 %) from the center', () => {
		assert.equal(clip.length, 65);
		assert.deepEqual(clip[0], clip[clip.length - 1]);
		for (const vertex of clip) {
			assert.ok(Math.abs(haversine(center, vertex) - 500) <= 5, `vertex at ${haversine(center, vertex)} m`);
		}
	});
});

describe('clipToCircle', () => {
	it('returns the circle when the polygon contains it', () => {
		const result = clipToCircle({ type: 'Polygon', coordinates: [square(center, 0.05)] }, clip);
		assert.equal(result?.type, 'Polygon');
		const [outer] = result!.coordinates as Position[][];
		assert.ok(Math.abs(area(outer) - area(clip)) / area(clip) < 1e-9);
	});

	it('returns null when the polygon is entirely outside', () => {
		assert.equal(clipToCircle({ type: 'Polygon', coordinates: [square(far, 0.01)] }, clip), null);
	});

	it('keeps every vertex of a partial overlap within the radius', () => {
		// Square whose left half covers the center: the clipped shape is a half-disc.
		const [lng, lat] = center;
		const result = clipToCircle({ type: 'Polygon', coordinates: [square([lng - 0.01, lat], 0.01)] }, clip);
		assert.equal(result?.type, 'Polygon');
		for (const vertex of positions(result!.coordinates)) assert.ok(haversine(center, vertex) <= 500 * 1.01);
		const [outer] = result!.coordinates as Position[][];
		assert.ok(Math.abs(area(outer) / area(clip) - 0.5) < 0.01);
	});

	it('keeps a hole that lies inside the circle', () => {
		const hole = square(center, 0.001);
		const result = clipToCircle({ type: 'Polygon', coordinates: [square(center, 0.05), hole] }, clip);
		const rings = result!.coordinates as Position[][];
		assert.equal(rings.length, 2);
		assert.ok(Math.abs(area(rings[1]) - area(hole)) / area(hole) < 1e-9);
	});

	it('drops the parts of a MultiPolygon outside the circle', () => {
		const inside = square(center, 0.001);
		const result = clipToCircle({ type: 'MultiPolygon', coordinates: [[inside], [square(far, 0.01)]] }, clip);
		assert.equal(result?.type, 'Polygon');
		assert.ok(Math.abs(area((result!.coordinates as Position[][])[0]) - area(inside)) / area(inside) < 1e-9);
	});
});

describe('coverageAround', () => {
	const features = [
		{ properties: { technology: 'fibra', name: 'KM11 - ZONA' }, geometry: { type: 'Polygon', coordinates: [square(center, 0.05)] } },
		{ properties: { technology: 'wireless', name: 'LEJOS' }, geometry: { type: 'Polygon', coordinates: [square(far, 0.01)] } },
	];

	it('returns only nearby zones, clipped, with no name', () => {
		const zones = coverageAround(center, features);
		assert.equal(zones.type, 'FeatureCollection');
		assert.equal(zones.features.length, 1);
		assert.deepEqual(zones.features[0].properties, { technology: 'fibra' });
		for (const vertex of positions(zones.features[0].geometry.coordinates)) {
			assert.ok(haversine(center, vertex) <= 500 * 1.01);
		}
	});

	it('honors a precomputed bbox', () => {
		const withBbox = features.map((feature) => ({ ...feature, bbox: bboxOf(feature.geometry.coordinates) }));
		assert.deepEqual(coverageAround(center, withBbox), coverageAround(center, features));
	});

	it('is empty when nothing is within the radius', () => {
		assert.deepEqual(coverageAround([-68.2, -33.5], features).features, []);
	});
});
