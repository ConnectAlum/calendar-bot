

import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { InteractionResponseFlags } from 'discord-interactions';
import { DEMOS_COMMAND, PING_COMMAND } from './commands';
import { getEventsOfInterest } from './calendar';

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
  async fetch(req: Request, env: Env, ctx: { waitUntil: (p: Promise<any>) => void }) {
		const { isValid, interaction } = await verifyDiscordRequest(
			req,
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
					ctx.waitUntil((async () => {
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
						const payload = {
								embeds: [
									{
										title: 'Upcoming Demos',
										description: e.map((event) => {
											const date = new Date(event.start?.dateTime ?? event.start?.date ?? 0);
											const ts = `<t:${Math.floor(date.getTime() / 1000)}>`;
											return `**[${event.summary}](${event.htmlLink})**\n${ts}`;
										}).join('\n\n'),
										color: 0x03fcfc,
										footer: {
											text: `Found ${e.length} events of interest in the next ${days} days`,
										},
										timestamp: new Date().toISOString(),
									}
								],
						};
						const res = await fetch(`https://discord.com/api/v9/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`, {
							method: "PATCH",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								...payload,
							}),
						});
					})())
					return new JsonResponse({
						type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
					});
				}
				default:
					return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
			}
		}

		console.error('Unknown Type');
		return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
	},
};

export default server;
