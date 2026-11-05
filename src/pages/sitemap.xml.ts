import type { APIRoute } from 'astro';

export const prerender = true;

/** Public, indexable pages. Add new pages here. */
const paths = ['/'];

export const GET: APIRoute = ({ site }) => {
	const urls = paths.map((path) => `\t<url><loc>${new URL(path, site)}</loc></url>`).join('\n');
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

	return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
