// Resolves the visitor's address when the site runs behind a reverse proxy (nginx).
// Kept free of Astro imports so it can be tested with plain Node.

/** A proxy on the same host as the Node process connects from loopback. */
export const LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/**
 * Who sent the request. Behind a trusted proxy that's the last X-Forwarded-For entry, the one the
 * proxy itself appended: earlier entries come from the client and can be forged. Connections from
 * anywhere else are taken at their socket address, so a forged header from outside does nothing.
 *
 * Expects the socket address: with `security.allowedDomains` set, Astro's `clientAddress` becomes
 * the *first* forwarded entry instead, and this check would no longer hold.
 */
export function clientIp(socketAddress: string, forwardedFor: string | null, trustedProxies: readonly string[]): string {
	if (!trustedProxies.includes(socketAddress)) return socketAddress;
	const hops = (forwardedFor ?? '')
		.split(',')
		.map((hop) => hop.trim())
		.filter(Boolean);
	return hops.at(-1) ?? socketAddress;
}
