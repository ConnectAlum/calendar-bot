import { ApplicationCommandOptionType } from "discord-api-types/v10"

export const PING_COMMAND = {
	name: 'ping',
	description: 'Replies with Pong!',
}

export const DEMOS_COMMAND = {
	name: 'demos',
	description: 'Lists upcoming demos. Don\'t break prod!',
	options: [
		{
			name: "days",
			description: "Number of days to look ahead (default: 7)",
			type: ApplicationCommandOptionType.Number,
			required: false,
		}
	]
}
