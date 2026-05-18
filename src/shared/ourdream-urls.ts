export function ourdreamChatUrl(profileUrl: string): string {
	return profileUrl.replace(/(^https?:\/\/[^/]+)\/c\//i, "$1/chat/");
}
