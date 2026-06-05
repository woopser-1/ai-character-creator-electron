import type { ReactNode } from "react";

interface ConversationTargetDetailLayoutProps {
	backBar: ReactNode;
	identity: ReactNode;
	children: ReactNode;
}

export function ConversationTargetDetailLayout({
	backBar,
	identity,
	children,
}: ConversationTargetDetailLayoutProps) {
	return (
		<div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10">
			{backBar}

			<div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-[20rem_1fr] xl:grid-cols-[22rem_1fr] xl:gap-x-14">
				<aside>{identity}</aside>
				<main className="min-w-0">{children}</main>
			</div>
		</div>
	);
}
