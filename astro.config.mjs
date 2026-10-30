// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	// Pages stay prerendered; the adapter only serves on-demand parts (the live reviews island).
	adapter: node({ mode: 'standalone' }),
	env: {
		schema: {
			// Google Business Profile API (reviews). Without them the curated reviews in site.ts are shown.
			GBP_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
			GBP_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
			GBP_REFRESH_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
			/** Format: accounts/{accountId}/locations/{locationId} */
			GBP_LOCATION: envField.string({ context: 'server', access: 'secret', optional: true }),
			/**
			 * Comma-separated addresses of reverse proxies whose X-Forwarded-For is trusted, besides
			 * loopback. Without the right one, every visitor shares the coverage lookup rate limit.
			 */
			COVERAGE_TRUSTED_PROXIES: envField.string({ context: 'server', access: 'public', optional: true }),
		},
	},
	fonts: [
		{
			provider: fontProviders.fontshare(),
			name: 'General Sans',
			cssVariable: '--font-display',
			weights: ['400', '500', '600'],
			fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'Inter',
			cssVariable: '--font-body',
			weights: ['400 700'],
			subsets: ['latin'],
			fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'Instrument Serif',
			cssVariable: '--font-serif',
			styles: ['italic'],
			subsets: ['latin'],
			fallbacks: ['Georgia', 'serif'],
		},
	],
});
