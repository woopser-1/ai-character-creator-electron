import { ipcMain } from "electron";
import type {
	UserPersonaInput,
	UserPersonaResult,
} from "@shared/runtime-chat";
import { userPersonaSchema } from "@shared/runtime-chat";
import {
	deleteUserPersona,
	listUserPersonas,
	saveUserPersona,
} from "../storage/user-personas";

export function registerUserPersonasIpc(): void {
	ipcMain.handle("user-personas:list", async () => {
		return listUserPersonas();
	});

	ipcMain.handle(
		"user-personas:create",
		async (_event, input: UserPersonaInput): Promise<UserPersonaResult> => {
			try {
				const parsed = userPersonaSchema
					.omit({ id: true, createdAt: true, updatedAt: true })
					.parse(input);
				const persona = await saveUserPersona(parsed);

				return { success: true, persona };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"user-personas:update",
		async (
			_event,
			payload: { id: string; input: UserPersonaInput },
		): Promise<UserPersonaResult> => {
			try {
				const parsed = userPersonaSchema
					.omit({ id: true, createdAt: true, updatedAt: true })
					.parse(payload.input);
				const persona = await saveUserPersona(parsed, payload.id);

				return { success: true, persona };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle("user-personas:delete", async (_event, id: string) => {
		await deleteUserPersona(id);
		return { success: true as const };
	});
}
