// Geometry and address helpers for the coverage map. No DOM or map imports, so they can be
// tested with plain Node and run in the browser without pulling in MapLibre.

export type Position = [lng: number, lat: number];
type Ring = Position[];
type Geometry = { type: string; coordinates: unknown };
type CoverageFeature = { properties: { technology: string }; geometry: Geometry };

/** Every [lng, lat] pair in a (Multi)Polygon's nested coordinate arrays. */
export const positions = (coords: unknown): Position[] =>
	typeof (coords as number[])[0] === 'number' ? [coords as Position] : (coords as unknown[]).flatMap(positions);

/** Ray casting: counts how many ring edges a horizontal ray from the point crosses. */
function inRing([x, y]: Position, ring: Ring): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

/** Inside the outer ring and outside every hole. */
const inPolygon = (point: Position, [outer, ...holes]: Ring[]) =>
	inRing(point, outer) && !holes.some((hole) => inRing(point, hole));

function inGeometry(point: Position, geometry: Geometry): boolean {
	if (geometry.type === 'Polygon') return inPolygon(point, geometry.coordinates as Ring[]);
	if (geometry.type === 'MultiPolygon') return (geometry.coordinates as Ring[][]).some((polygon) => inPolygon(point, polygon));
	return false;
}

/** Technologies whose zones contain the point, e.g. ['fibra'] or []. */
export function technologiesAt(point: Position, features: CoverageFeature[]): string[] {
	const found = new Set<string>();
	for (const feature of features) {
		if (inGeometry(point, feature.geometry)) found.add(feature.properties.technology);
	}
	return [...found];
}

/** How far around a searched address the map reveals coverage. */
export const COVERAGE_RADIUS_M = 500;

const METERS_PER_DEGREE_LAT = 110540;
const metersPerDegreeLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

/**
 * Counter-clockwise polygon approximating a circle. A local equirectangular projection is
 * accurate to a few centimeters at this scale, so no geodesic math is needed.
 */
export function circle([lng, lat]: Position, radiusM: number, sides = 64): Ring {
	const ring: Ring = [];
	for (let i = 0; i < sides; i++) {
		const angle = (i / sides) * 2 * Math.PI;
		ring.push([lng + (radiusM * Math.cos(angle)) / metersPerDegreeLng(lat), lat + (radiusM * Math.sin(angle)) / METERS_PER_DEGREE_LAT]);
	}
	return [...ring, ring[0]];
}

export type Bbox = [minLng: number, minLat: number, maxLng: number, maxLat: number];

export function bboxOf(coords: unknown): Bbox {
	const box: Bbox = [Infinity, Infinity, -Infinity, -Infinity];
	for (const [lng, lat] of positions(coords)) {
		box[0] = Math.min(box[0], lng);
		box[1] = Math.min(box[1], lat);
		box[2] = Math.max(box[2], lng);
		box[3] = Math.max(box[3], lat);
	}
	return box;
}

const overlaps = (a: Bbox, b: Bbox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/** Whether the point is on the inner (left) side of the edge a→b of a counter-clockwise polygon. */
const isInside = ([ax, ay]: Position, [bx, by]: Position, [px, py]: Position) =>
	(bx - ax) * (py - ay) - (by - ay) * (px - ax) >= 0;

/** Where the segment p→q crosses the line through a→b. */
function intersection([ax, ay]: Position, [bx, by]: Position, [px, py]: Position, [qx, qy]: Position): Position {
	const [dx1, dy1, dx2, dy2] = [bx - ax, by - ay, qx - px, qy - py];
	const t = (dx1 * (ay - py) - dy1 * (ax - px)) / (dx1 * dy2 - dy1 * dx2);
	return [px + t * dx2, py + t * dy2];
}

/**
 * Sutherland–Hodgman: trims the ring against each edge of the convex clip polygon in turn.
 * Correct for any ring as long as the clip polygon is convex, which a circle always is.
 */
function clipRing(ring: Ring, clip: Ring): Ring | null {
	const [first, last] = [ring[0], ring[ring.length - 1]];
	let output = first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;

	for (let i = 0; i < clip.length - 1 && output.length > 0; i++) {
		const [a, b] = [clip[i], clip[i + 1]];
		const input = output;
		output = [];
		input.forEach((current, j) => {
			const previous = input[(j + input.length - 1) % input.length];
			if (isInside(a, b, current)) {
				if (!isInside(a, b, previous)) output.push(intersection(a, b, previous, current));
				output.push(current);
			} else if (isInside(a, b, previous)) {
				output.push(intersection(a, b, previous, current));
			}
		});
	}
	return output.length >= 3 ? [...output, output[0]] : null;
}

/** Holes that fall outside the clip are dropped; a polygon whose outer ring does is gone. */
function clipPolygon([outer, ...holes]: Ring[], clip: Ring): Ring[] | null {
	const clipped = clipRing(outer, clip);
	if (!clipped) return null;
	return [clipped, ...holes.map((hole) => clipRing(hole, clip)).filter((hole) => hole !== null)];
}

type PolygonGeometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

/** The part of a (Multi)Polygon inside the clip polygon, or null when nothing is left. */
export function clipToCircle(geometry: Geometry, clip: Ring): PolygonGeometry | null {
	const polygons =
		geometry.type === 'Polygon'
			? [geometry.coordinates as Ring[]]
			: geometry.type === 'MultiPolygon'
				? (geometry.coordinates as Ring[][])
				: [];
	const clipped = polygons.map((polygon) => clipPolygon(polygon, clip)).filter((polygon) => polygon !== null);
	if (clipped.length === 0) return null;
	return clipped.length === 1 ? { type: 'Polygon', coordinates: clipped[0] } : { type: 'MultiPolygon', coordinates: clipped };
}

export type CoverageZones = {
	type: 'FeatureCollection';
	features: { type: 'Feature'; properties: { technology: string }; geometry: PolygonGeometry }[];
};

/**
 * Zones cut down to the circle around the point. Only the technology goes out: zone names are
 * internal network labels. Features may carry a precomputed GeoJSON `bbox` to skip the scan.
 */
export function coverageAround(
	point: Position,
	features: (CoverageFeature & { bbox?: Bbox })[],
	radiusM = COVERAGE_RADIUS_M,
): CoverageZones {
	const clip = circle(point, radiusM);
	const clipBox = bboxOf(clip);
	const zones: CoverageZones['features'] = [];
	for (const feature of features) {
		if (!overlaps(feature.bbox ?? bboxOf(feature.geometry.coordinates), clipBox)) continue;
		const geometry = clipToCircle(feature.geometry, clip);
		if (geometry) zones.push({ type: 'Feature', properties: { technology: feature.properties.technology }, geometry });
	}
	return { type: 'FeatureCollection', features: zones };
}

export type AddressMatch = { label: string; position: Position };

/** Lowercase without accents, so "Godoy Cruz" matches "GODOY CRUZ" and "Maipú" matches "maipu". */
const normalize = (text: string) =>
	text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.trim();

/** Georef answers in caps ("AV GRL SAN MARTIN 1200"); show it in title case. */
const titleCase = (text: string) => text.toLowerCase().replace(/(^|[\s,.(])(\p{L})/gu, (_, sep, char) => sep + char.toUpperCase());

/**
 * Splits "San Martín 1200, Godoy Cruz" into the street part Georef expects and an optional
 * hint (department or locality) used to narrow the results.
 */
export function parseAddress(query: string): { street: string; hint: string } {
	const [street, ...rest] = query.split(',');
	return { street: street.trim(), hint: normalize(rest.join(' ')) };
}

type GeorefAddress = {
	nomenclatura: string;
	ubicacion?: { lat: number | null; lon: number | null } | null;
	departamento?: { nombre?: string | null } | null;
	localidad_censal?: { nombre?: string | null } | null;
};

/** Georef results → unique, located matches, preferring those that match the hint. */
export function toMatches(results: GeorefAddress[], hint = ''): AddressMatch[] {
	const seen = new Set<string>();
	const matches: (AddressMatch & { hinted: boolean })[] = [];

	for (const result of results) {
		const { lat, lon } = result.ubicacion ?? {};
		if (lat == null || lon == null || seen.has(result.nomenclatura)) continue;
		seen.add(result.nomenclatura);

		const place = normalize(`${result.departamento?.nombre ?? ''} ${result.localidad_censal?.nombre ?? ''}`);
		matches.push({
			label: titleCase(result.nomenclatura),
			position: [lon, lat],
			hinted: hint !== '' && hint.split(/\s+/).every((word) => place.includes(word)),
		});
	}

	const hinted = matches.filter((match) => match.hinted);
	return (hinted.length ? hinted : matches).map(({ label, position }) => ({ label, position }));
}
