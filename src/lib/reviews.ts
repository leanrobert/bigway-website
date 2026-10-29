// Pure helpers to turn Google Business Profile reviews into what the site shows.
// Kept free of Astro/env imports so they can be tested with plain Node.

export type Review = { author: string; text: string };
export type ReviewSummary = { rating: number; count: number };

/** Subset of the v4 `Review` resource the site uses. */
export type GbpReview = {
	reviewer?: { displayName?: string; isAnonymous?: boolean };
	starRating?: 'STAR_RATING_UNSPECIFIED' | 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
	comment?: string;
	updateTime?: string;
};

const stars: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** Shortest comment worth featuring; one-word reviews ("Excelente") say little on their own. */
const MIN_LENGTH = 25;

/** "martin martinez" → "Martin M.", keeping privacy consistent with the curated reviews. */
export function formatAuthor(reviewer: GbpReview['reviewer']): string {
	const name = reviewer?.isAnonymous ? '' : (reviewer?.displayName ?? '').trim();
	if (!name) return 'Cliente de Bigway';

	const [first, ...rest] = name.split(/\s+/);
	const capitalize = (word: string) => word.charAt(0).toLocaleUpperCase('es-AR') + word.slice(1).toLocaleLowerCase('es-AR');
	const initial = rest.length ? ` ${rest[rest.length - 1].charAt(0).toLocaleUpperCase('es-AR')}.` : '';
	return capitalize(first) + initial;
}

/**
 * Google appends machine translations as "(Translated by Google) … (Original) …".
 * Keep only the original text the customer wrote.
 */
export function cleanComment(comment = ''): string {
	const original = comment.split('(Original)').pop() ?? comment;
	return original.replace(/\(Translated by Google\)/g, '').trim();
}

/** Best reviews first: highest rating, then most recent, skipping very short comments. */
export function pickBestReviews(reviews: GbpReview[], limit = 5): Review[] {
	return reviews
		.map((review) => ({
			rating: stars[review.starRating ?? ''] ?? 0,
			time: Date.parse(review.updateTime ?? '') || 0,
			author: formatAuthor(review.reviewer),
			text: cleanComment(review.comment),
		}))
		.filter((review) => review.rating >= 4 && review.text.length >= MIN_LENGTH)
		.sort((a, b) => b.rating - a.rating || b.time - a.time)
		.slice(0, limit)
		.map(({ author, text }) => ({ author, text }));
}
