import { useCallback, useEffect, useState } from "react";

export type ApiKeyStatusKind = "checking" | "present" | "missing";

export interface ApiKeyStatusState {
	status: ApiKeyStatusKind;
	maskedHint?: string;
	refresh: () => Promise<void>;
}

const listeners = new Set<(state: ApiKeyStatusState) => void>();
let currentState: ApiKeyStatusState = {
	status: "checking",
	refresh: async () => {},
};
let inFlight: Promise<void> | null = null;

function setState(next: Omit<ApiKeyStatusState, "refresh">) {
	currentState = { ...next, refresh };
	for (const l of listeners) l(currentState);
}

async function refresh(): Promise<void> {
	if (inFlight) return inFlight;
	inFlight = (async () => {
		try {
			const result = await window.api.settings.apiKeyStatus();
			setState({
				status: result.hasKey ? "present" : "missing",
				maskedHint: result.maskedHint,
			});
		} catch {
			setState({ status: "missing" });
		} finally {
			inFlight = null;
		}
	})();
	return inFlight;
}

let bootstrapped = false;

export function useApiKeyStatus(): ApiKeyStatusState {
	const [state, setLocal] = useState<ApiKeyStatusState>(currentState);

	useEffect(() => {
		const listener = (s: ApiKeyStatusState) => setLocal(s);
		listeners.add(listener);
		if (!bootstrapped) {
			bootstrapped = true;
			void refresh();
		}
		return () => {
			listeners.delete(listener);
		};
	}, []);

	const wrappedRefresh = useCallback(() => refresh(), []);

	return { ...state, refresh: wrappedRefresh };
}
