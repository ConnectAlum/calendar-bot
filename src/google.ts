import { google } from "worker-auth-providers";

const SCOPES = [
	"https://www.googleapis.com/auth/calendar.readonly openid email profile"
]

export const getAuthUrl = async (request: Request, env: Env) => {
	const loginUrl = await google.redirect({
		options: {
			clientId: env.GOOGLE_OAUTH_CLIENT_ID,
			redirectTo: env.BASE_URL + '/oauth/callback',
			scope: SCOPES,

		}
	})
	console.log('loginUrl', loginUrl);
	return loginUrl + "&approval_prompt=force&access_type=offline";
}

export const completeOAuth = async (request: Request, env: Env) => {
	const { user: providerUser, tokens } = await google.users({
		options: {
			clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
			clientId: env.GOOGLE_OAUTH_CLIENT_ID,
			redirectUrl: env.BASE_URL + '/oauth/callback',
		},
		request
	});
	//console.log('providerUser', providerUser);
	//console.log('tokens', tokens);
	console.log({ providerUser, tokens });
	if (!tokens.refresh_token) {
		return false;
	}
	env.connect_calendar.put('google_refresh_token', tokens.refresh_token);
	env.connect_calendar.put("google_token", tokens.access_token);
	const expire = new Date().getTime() + tokens.expires_in * 1000;
	env.connect_calendar.put('google_token_expire', expire.toString());
	//env.connect_calendar.put('google_user', JSON.stringify(providerUser));
	return true;
}

export const getWorkingToken = async (env: Env) => {
	const expire = await env.connect_calendar.get('google_token_expire', 'text');
	const token = await env.connect_calendar.get('google_token', 'text');
	const refreshToken = await env.connect_calendar.get('google_refresh_token', 'text');
	if (!expire || !token || !refreshToken) {
		return false;
	}
	if (parseInt(expire) < new Date().getTime()) {
		const data = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				client_id: env.GOOGLE_OAUTH_CLIENT_ID,
				client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
				refresh_token: refreshToken,
				grant_type: 'refresh_token'
			})
		});
		const newToken = await data.json() as { access_token: string, expires_in: number };
		if (!newToken.access_token) {
			return false;
		}
		env.connect_calendar.put('google_token', newToken.access_token);
		env.connect_calendar.put('google_token_expire', (new Date().getTime() + newToken.expires_in * 1000).toString());
	}
	return await env.connect_calendar.get('google_token', 'text');
}
