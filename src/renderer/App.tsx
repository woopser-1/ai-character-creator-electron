import { AnimatePresence, motion } from "motion/react";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { FilesSheetProvider } from "@/components/files-sheet";
import { GroupChatsFilesSheetProvider } from "@/components/group-chats-files-sheet";
import { NavHeader } from "@/components/nav-header";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useImageRefreshNotifier } from "@/hooks/use-image-refresh-notifier";
import { useUpdateNotifier } from "@/hooks/use-update-notifier";
import { ChromeProvider, useChromeRefs } from "@/lib/chrome-context";
import { useRoute } from "@/lib/router";
import { CharacterDetailPage } from "@/pages/CharacterDetail";
import { CreatePage } from "@/pages/Create";
import { CreateGroupChatPage } from "@/pages/CreateGroupChat";
import { GalleryPage } from "@/pages/Gallery";
import { GroupChatDetailPage } from "@/pages/GroupChatDetail";
import { GroupChatsPage } from "@/pages/GroupChats";
import { RegeneratePage } from "@/pages/Regenerate";
import { SettingsPage } from "@/pages/Settings";

export function App() {
	return (
		<TooltipProvider delay={400}>
			<ToastProvider>
				<ChromeProvider>
					<FilesSheetProvider>
						<GroupChatsFilesSheetProvider>
							<AppShell />
						</GroupChatsFilesSheetProvider>
					</FilesSheetProvider>
				</ChromeProvider>
			</ToastProvider>
		</TooltipProvider>
	);
}

function AppShell() {
	const route = useRoute();
	const { setSubHeaderEl, setChatDockEl } = useChromeRefs();
	useUpdateNotifier();
	useImageRefreshNotifier();

	return (
		<div className="flex h-screen flex-col overflow-hidden">
			<NavHeader />
			<ApiKeyBanner />
			<div className="shrink-0" ref={setSubHeaderEl} />
			<AnimatePresence initial={false} mode="wait">
				<motion.main
					animate={{ opacity: 1, y: 0 }}
					className="flex min-h-0 flex-1 flex-col overflow-y-auto"
					exit={{ opacity: 0, y: -4 }}
					initial={{ opacity: 0, y: 6 }}
					key={route.name}
					transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
				>
					{route.name === "gallery" && <GalleryPage />}
					{route.name === "create" && <CreatePage />}
					{route.name === "settings" && <SettingsPage />}
					{route.name === "character" && <CharacterDetailPage id={route.id} />}
					{route.name === "regenerate" && <RegeneratePage id={route.id} />}
					{route.name === "group-chats" && <GroupChatsPage />}
					{route.name === "group-chats-create" && <CreateGroupChatPage />}
					{route.name === "group-chat" && <GroupChatDetailPage id={route.id} />}
				</motion.main>
			</AnimatePresence>
			<div className="shrink-0" ref={setChatDockEl} />
		</div>
	);
}
