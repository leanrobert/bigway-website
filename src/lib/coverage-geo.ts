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
