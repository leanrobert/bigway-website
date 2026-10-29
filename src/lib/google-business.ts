import { GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_LOCATION, GBP_REFRESH_TOKEN } from 'astro:env/server';
import { pickBestReviews, type GbpReview, type Review, type ReviewSummary } from './reviews';

export type LiveReviews = { summary: ReviewSummary; reviews: Review[] };

/** Reviews change slowly and the API has quotas, so one fetch serves everyone for a while. */
const CACHE_TTL = 6 * 60 * 60 * 1000;
/** After a failure, wait before calling Google again instead of retrying on every visit. */
const RETRY_AFTER = 10 * 60 * 1000;
const TIMEOUT = 5000;

let cache: { data: LiveReviews; expires: number } | null = null;
let retryAt = 0;

async function getAccessToken(): Promise<string> {
	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		body: new URLSearchParams({
			client_id: GBP_CLIENT_ID!,
			client_secret: GBP_CLIENT_SECRET!,
			refresh_token: GBP_REFRESH_TOKEN!,
			grant_type: 'refresh_token',
		}),
		signal: AbortSignal.timeout(TIMEOUT),
	});
	if (!response.ok) throw new Error(`OAuth token request failed: ${response.status}`);
	return (await response.json()).access_token;
}

async function fetchReviews(): Promise<LiveReviews> {
	const token = await getAccessToken();
	// Highest rated first; 50 is the API's page maximum and plenty to pick five from.
	const url = new URL(`https://mybusiness.googleapis.com/v4/${GBP_LOCATION}/reviews`);
	url.searchParams.set('pageSize', '50');
	url.searchParams.set('orderBy', 'rating desc');

	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(TIMEOUT),
	});
	if (!response.ok) throw new Error(`Reviews request failed: ${response.status}`);

	const body: { reviews?: GbpReview[]; averageRating?: number; totalReviewCount?: number } = await response.json();
	return {
		summary: { rating: body.averageRating ?? 0, count: body.totalReviewCount ?? 0 },
		reviews: pickBestReviews(body.reviews ?? []),
	};
}

/**
 * Live reviews from the Business Profile, cached in memory.
 * Returns null when the API isn't configured or fails with nothing cached,
 * so callers can fall back to the curated reviews.
 */
export async function getLiveReviews(): Promise<LiveReviews | null> {
	if (!GBP_CLIENT_ID || !GBP_CLIENT_SECRET || !GBP_REFRESH_TOKEN || !GBP_LOCATION) return null;
	if (cache && cache.expires > Date.now()) return cache.data;
	if (Date.now() < retryAt) return cache?.data ?? null;

	try {
		const data = await fetchReviews();
		if (data.reviews.length === 0) return cache?.data ?? null;
		cache = { data, expires: Date.now() + CACHE_TTL };
		return data;
	} catch (error) {
		console.error('[reviews] Could not load Google Business Profile reviews:', error);
		retryAt = Date.now() + RETRY_AFTER;
		// A stale copy beats falling back to the hand-picked list.
		return cache?.data ?? null;
	}
}
