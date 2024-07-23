import { getWorkingToken } from "./google";
import { CalEvent, EventsResponse } from "./types";

const contains = (text: string, keywords: string[]) => {
	for (const keyword of keywords) {
		if (text?.includes(keyword)) {
			return true;
		}
	}
	return false;
}

const test = (event: CalEvent) => {
	const keywords = ["demo", "pitch"];
	const description = event.description?.toLowerCase();
	const summary = event.summary?.toLowerCase();

	const color = event.colorId === "6";
	const containsKeywords = contains(description, keywords) || contains(summary, keywords);
	console.log({
		name: event.summary,
		color,
		containsKeywords
	})
	return color || containsKeywords;
}

export const getEvents = async (env: Env, days: number = 7) => {
	const token = await getWorkingToken(env);
	if (!token) {
		throw	new Error('No token');
	}
	// fetch https://www.googleapis.com/calendar/v3/users/me/calendarList
	const timeMin = new Date().toISOString();
	const timeMax = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * days).toISOString();
	const query = `?orderBy=startTime&singleEvents=true&timeMin=${timeMin}&timeMax=${timeMax}`;
	const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${env.CALENDAR_ID}/events${query}`, {
		headers: { Authorization: `Bearer ${token}` }
	})
	if (!response.ok) {
		console.error('Failed to fetch calendar list', response.status, response.statusText);
		return [];
	}
	const data = await response.json() as EventsResponse;
	return data.items;
}
export const getEventsOfInterest = async (env: Env, days: number = 7) => {
	const events = await getEvents(env, days);
	console.log({events})
	return events.filter(test);
}

