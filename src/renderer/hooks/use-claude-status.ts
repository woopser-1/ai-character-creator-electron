import { useCallback, useEffect, useState } from "react";

export type ClaudeStatus = "checking" | "connected" | "disconnected";

export interface ClaudeStatusState {
	status: ClaudeStatus;
	version?: string;
	error?: string;
	recheck: () => Promise<void>;
}

const listeners = new Set<(state: ClaudeStatusState) => void>();
let currentState: ClaudeStatusState = {
	status: "checking",
	recheck: async () => {},
};
let inFlight: Promise<void> | null = null;

function setState(next: Omit<ClaudeStatusState, "recheck">) {
	currentState = { ...next, recheck };
	for (const l of listeners) l(currentState);
}

async function recheck(): Promise<void> {
	if (inFlight) return inFlight;
	setState({ status: "checking" });
	inFlight = (async () => {
		try {
			const result = await window.api.claude.check();
			if (result.available) {
				setState({ status: "connected", version: result.version });
			} else {
				setState({ status: "disconnected", error: result.error });
			}
		} catch (err) {
			setState({ status: "disconnected", error: String(err) });
		} finally {
			inFlight = null;
		}
	})();
	return inFlight;
}

let bootstrapped = false;

export function useClaudeStatus(): ClaudeStatusState {
	const [state, setLocal] = useState<ClaudeStatusState>(currentState);

	useEffect(() => {
		const listener = (s: ClaudeStatusState) => setLocal(s);
		listeners.add(listener);
		if (!bootstrapped) {
			bootstrapped = true;
			void recheck();
		}
		return () => {
			listeners.delete(listener);
		};
	}, []);

	const wrappedRecheck = useCallback(() => recheck(), []);

	return { ...state, recheck: wrappedRecheck };
}
