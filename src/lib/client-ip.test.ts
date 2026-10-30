import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clientIp, LOOPBACK } from './client-ip.ts';

// Documentation ranges (RFC 5737): never real visitors.
const visitor = '203.0.113.7';
const forged = '198.51.100.1';

describe('clientIp', () => {
	it('uses the address the trusted proxy appended', () => {
		assert.equal(clientIp('127.0.0.1', visitor, LOOPBACK), visitor);
	});

	it('ignores entries the client forged before the proxy appended the real one', () => {
		assert.equal(clientIp('127.0.0.1', `${forged}, ${visitor}`, LOOPBACK), visitor);
	});

	it('ignores the header on connections that do not come from a trusted proxy', () => {
		assert.equal(clientIp(visitor, forged, LOOPBACK), visitor);
	});

	it('falls back to the socket address when the proxy sends no header', () => {
		assert.equal(clientIp('127.0.0.1', null, LOOPBACK), '127.0.0.1');
		assert.equal(clientIp('127.0.0.1', ' , ', LOOPBACK), '127.0.0.1');
	});

	it('trusts extra proxies passed in', () => {
		assert.equal(clientIp('192.0.2.10', visitor, [...LOOPBACK, '192.0.2.10']), visitor);
	});
});
