import jwt from '@tsndr/cloudflare-worker-jwt'
import { Buffer } from 'node:buffer'

type ServiceAccountConfig = {
	type: string;
	project_id: string;
	private_key_id: string;
	private_key: string;
	client_email: string;
	client_id: string;
	auth_uri: string;
	token_uri: string;
	auth_provider_x509_cert_url: string;
	client_x509_cert_url: string;
	universe_domain: string;
}

export const getWorkingToken = async (env: Env) => {
	const b64 = env.GOOGLE_SERVICE_ACCOUNT;
	const buff = Buffer.from(b64, 'base64');
	const text = buff.toString('ascii');
	const serviceAccount = JSON.parse(text) as ServiceAccountConfig;
	const now = Math.floor(Date.now() / 1000);
	const expire = now + 3600;
	const payload = {
		iss: serviceAccount.client_email,
		sub: serviceAccount.client_email,
		aud: serviceAccount.token_uri,
		iat: now,
		exp: expire,
		scope: 'https://www.googleapis.com/auth/calendar.readonly',
	};
	const token = await jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });
	const reqPayload = {
		grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
		assertion: token,
	}
	const response = await fetch(serviceAccount.token_uri, {
		method: 'POST',
		body: JSON.stringify(reqPayload),
	});
	if (!response.ok) {
		console.error('Failed to get token', response.status, response.statusText);
		console.error(await response.text());
		return null;
	}
	const data = await response.json() as { access_token: string };
	console.log('Got token', data);
	return data.access_token;
}
