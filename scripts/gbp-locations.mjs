// Lists the Business Profile accounts/locations the refresh token can see, to fill GBP_LOCATION.
// Usage: pnpm gbp:locations   (reads GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN from .env)
const { GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN } = process.env;

if (!GBP_CLIENT_ID || !GBP_CLIENT_SECRET || !GBP_REFRESH_TOKEN) {
	console.error('Set GBP_CLIENT_ID, GBP_CLIENT_SECRET and GBP_REFRESH_TOKEN in .env first.');
	process.exit(1);
}

async function getJson(url, init) {
	const response = await fetch(url, init);
	const body = await response.json();
	if (!response.ok) throw new Error(`${url} → ${response.status}: ${JSON.stringify(body.error ?? body)}`);
	return body;
}

const { access_token } = await getJson('https://oauth2.googleapis.com/token', {
	method: 'POST',
	body: new URLSearchParams({
		client_id: GBP_CLIENT_ID,
		client_secret: GBP_CLIENT_SECRET,
		refresh_token: GBP_REFRESH_TOKEN,
		grant_type: 'refresh_token',
	}),
});
const headers = { Authorization: `Bearer ${access_token}` };

const { accounts = [] } = await getJson('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', { headers });

for (const account of accounts) {
	const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`);
	url.searchParams.set('readMask', 'name,title,storefrontAddress');
	const { locations = [] } = await getJson(url, { headers });

	for (const location of locations) {
		const address = location.storefrontAddress?.addressLines?.join(', ') ?? '';
		// v4 reviews need the account in the path: accounts/{id}/locations/{id}.
		console.log(`${account.name}/${location.name}\t${location.title}\t${address}`);
	}
}
