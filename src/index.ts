

import { AutoRouter, text } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { InteractionResponseFlags } from 'discord-interactions';
import { DEMOS_COMMAND, PING_COMMAND } from './commands';
import { completeOAuth, getAuthUrl } from './google';
import { getEvents, getEventsOfInterest } from './calendar';

class JsonResponse extends Response {
  constructor(body?: any, init?: ResponseInit) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

const router = AutoRouter();

router.get('/', (request, env) => {
  return new Response("Hi :)");
});

router.get('/oauth', async (request, env) => {
	const url = await getAuthUrl(request, env);
	return Response.redirect(url, 302);
});

// callback route for google oauth
router.get('/oauth/callback', async (request, env) => {
	const success = await completeOAuth(request, env);
	if (success) {
		return new Response('Successfully authenticated with Google!');
	} else {
		return new Response('Failed to authenticate with Google.', { status: 500 });
	}
});

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    // Most user commands will come as `APPLICATION_COMMAND`.
    switch (interaction.data.name.toLowerCase()) {
      case PING_COMMAND.name.toLowerCase(): {
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "Pong!",
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
      case DEMOS_COMMAND.name.toLowerCase(): {
				const days = interaction.data.options?.find((o: any) => o.name === 'days')?.value ?? 7;
				try {
					const e = await getEventsOfInterest(env);
					if (!e.length) {
						return new JsonResponse({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: 'No events in the next week!',
								flags: InteractionResponseFlags.EPHEMERAL,
							},
						});
					}
					return new JsonResponse({
						type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
						data: {
							embeds: [
								{
									title: 'Upcoming Demos',
									description: e.map((event) => {
										const date = new Date(event.start?.dateTime ?? event.start?.date ?? 0);
										const ts = `<t:${Math.floor(date.getTime() / 1000)}>`;
										return `**${event.summary}**\n${ts}`;
									}).join('\n\n'),
									color: 0x03fcfc,
									footer: {
										text: `Found ${e.length} events of interest in the next ${days} days`,
									},
									timestamp: new Date().toISOString(),
								}
							],
							// flags: InteractionResponseFlags.EPHEMERAL,
						},
					});
				} catch (e: any) {
					console.error(e);
					if (e.message === 'No token') {
						return new JsonResponse({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: `No token! Please [auth with google](${env.BASE_URL}/oauth)`,
								flags: InteractionResponseFlags.EPHEMERAL,
							},
						});
					}
				}
      }
      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }
  }

  console.error('Unknown Type');
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});
router.all('*', () => new Response('Not Found.', { status: 404 }));

async function verifyDiscordRequest(request: Request, env: Env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

export default server;
