import { useEffect, useState } from "react";

export type Route =
	| { name: "gallery" }
	| { name: "create" }
	| { name: "settings" }
	| { name: "character"; id: string }
	| { name: "regenerate"; id: string }
	| { name: "group-chats" }
	| { name: "group-chats-create" }
	| { name: "group-chat"; id: string };

function parseHash(hash: string): Route {
	const h = hash.startsWith("#") ? hash.slice(1) : hash;
	const path = h.startsWith("/") ? h : `/${h}`;
	if (path === "/" || path === "") return { name: "gallery" };
	if (path === "/create") return { name: "create" };
	if (path === "/settings") return { name: "settings" };
	if (path === "/group-chats") return { name: "group-chats" };
	if (path === "/group-chats/create") return { name: "group-chats-create" };
	const groupChatMatch = path.match(/^\/group-chats\/([^/]+)$/);
	if (groupChatMatch) return { name: "group-chat", id: groupChatMatch[1] };
	const charMatch = path.match(/^\/character\/([^/]+)$/);
	if (charMatch) return { name: "character", id: charMatch[1] };
	const regenMatch = path.match(/^\/regenerate\/([^/]+)$/);
	if (regenMatch) return { name: "regenerate", id: regenMatch[1] };
	return { name: "gallery" };
}

export function useRoute(): Route {
	const [route, setRoute] = useState<Route>(() =>
		parseHash(window.location.hash),
	);
	useEffect(() => {
		const onChange = () => setRoute(parseHash(window.location.hash));
		window.addEventListener("hashchange", onChange);
		return () => window.removeEventListener("hashchange", onChange);
	}, []);
	return route;
}

export function navigate(to: string): void {
	const target = to.startsWith("#")
		? to
		: `#${to.startsWith("/") ? to : `/${to}`}`;
	window.location.hash = target.slice(1);
}
