// Conversion events for Google Tag Manager. GTM maps them to Google Ads conversion tags
// (Custom Event triggers), so event names here must match the triggers configured there.
// Never push personal data (name, phone, address): Google Ads policy forbids it in plain text.

declare global {
	interface Window {
		dataLayer?: Record<string, unknown>[];
	}
}

export type ConversionEvent =
	/** Any link that opens a WhatsApp chat. */
	| 'whatsapp_click'
	/** Contact form submitted (opens WhatsApp with the prefilled message). */
	| 'generate_lead';

export function track(event: ConversionEvent, params: Record<string, string> = {}): void {
	window.dataLayer = window.dataLayer || [];
	window.dataLayer.push({ event, ...params });
}

const whatsappHosts = new Set(['wa.link', 'wa.me', 'api.whatsapp.com']);

/**
 * Reports clicks on WhatsApp links anywhere on the page. One delegated listener instead of
 * one per button, so new CTAs are tracked as long as they point to WhatsApp.
 * `data-cta` on the link names where it sits, to compare CTAs in Google Ads.
 */
export function trackWhatsAppClicks(): void {
	document.addEventListener('click', (event) => {
		const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
		if (!link || !whatsappHosts.has(link.hostname)) return;
		track('whatsapp_click', { cta_location: link.dataset.cta ?? 'other' });
	});
}
