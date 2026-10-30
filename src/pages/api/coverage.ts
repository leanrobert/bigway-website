// Coverage lookup for one point: which technologies reach it and the zones within the radius,
// clipped. The full coverage map stays on the server so it can't be copied from the site.
//
// Privacy: the site promises not to keep searched addresses, so coordinates are never logged
// and responses are never cached.
import type { APIRoute } from 'astro';
import coverage from '../../data/coverage.json';
import { bboxOf, COVERAGE_RADIUS_M, coverageAround, technologiesAt } from '../../lib/coverage-geo';

export const prerender = false;

/** Mendoza province, with some slack: anything outside can't be a Bigway address. */
const SERVICE_AREA = { minLng: -70.6, maxLng: -66.4, minLat: -37.6, maxLat: -32.0 };

/**
 * Per-IP fixed window. Slows down rebuilding the map from a grid of lookups; a person checking
 * a few addresses never gets near it. In memory because the site runs as a single Node process.
 */
const RATE_LIMIT = { max: 30, windowMs: 10 * 60 * 1000, pruneAbove: 1000 };
const hits = new Map<string, { count: number; resetAt: number }>();

// Bounding boxes are computed once so each lookup only clips the zones near the point.
const features = coverage.features.map((feature) => ({ ...feature, bbox: bboxOf(feature.geometry.coordinates) }));

function isRateLimited(client: string, now = Date.now()): boolean {
	if (hits.size > RATE_LIMIT.pruneAbove) {
		for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
	}
	const entry = hits.get(client);
	if (!entry || entry.resetAt <= now) {
		hits.set(client, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
		return false;
	}
	entry.count++;
	return entry.count > RATE_LIMIT.max;
}

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});

/** A finite number, or NaN for a missing or malformed parameter. */
const parseCoordinate = (value: string | null) => (value === null || value.trim() === '' ? NaN : Number(value));

export const GET: APIRoute = ({ url, clientAddress }) => {
	if (isRateLimited(clientAddress)) return json(429, { error: 'rate_limited' });

	const lat = parseCoordinate(url.searchParams.get('lat'));
	const lng = parseCoordinate(url.searchParams.get('lng'));
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json(400, { error: 'invalid_coordinates' });
	if (lng < SERVICE_AREA.minLng || lng > SERVICE_AREA.maxLng || lat < SERVICE_AREA.minLat || lat > SERVICE_AREA.maxLat) {
		return json(400, { error: 'outside_service_area' });
	}

	try {
		const point: [number, number] = [lng, lat];
		return json(200, {
			technologies: technologiesAt(point, features),
			radius: COVERAGE_RADIUS_M,
			zones: coverageAround(point, features),
		});
	} catch (error) {
		// Only the error type: the message or stack could carry the coordinates.
		console.error('[coverage-api] Lookup failed:', error instanceof Error ? error.name : typeof error);
		return json(500, { error: 'lookup_failed' });
	}
};
