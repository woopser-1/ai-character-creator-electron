import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	className?: string;
	children: ReactNode;
}

export function Tabs({
	value,
	defaultValue,
	onValueChange,
	className,
	children,
}: TabsProps) {
	return (
		<BaseTabs.Root
			className={className}
			defaultValue={defaultValue}
			onValueChange={(v) => onValueChange?.(String(v))}
			value={value}
		>
			{children}
		</BaseTabs.Root>
	);
}

export function TabsList({
	className,
	...rest
}: ComponentPropsWithoutRef<typeof BaseTabs.List>) {
	return (
		<BaseTabs.List
			className={cn(
				"inline-flex items-center gap-1 rounded-xl bg-secondary p-1 ring-1 ring-foreground/10",
				className,
			)}
			{...rest}
		/>
	);
}

export function TabsTrigger({
	value,
	className,
	children,
	...rest
}: {
	value: string;
	className?: string;
	children: ReactNode;
} & Omit<ComponentPropsWithoutRef<typeof BaseTabs.Tab>, "value" | "children">) {
	return (
		<BaseTabs.Tab
			className={cn(
				"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-muted-foreground text-xs outline-none transition-all duration-200 ease-out hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40",
				// base-ui exposes the selected state as `data-active` on TabsTab,
				// not `data-selected` — the old selector never matched, so the
				// active styles were invisible.
				"data-[active]:bg-primary data-[active]:text-primary-foreground data-[active]:font-semibold data-[active]:glow-sm",
				className,
			)}
			value={value}
			{...rest}
		>
			{children}
		</BaseTabs.Tab>
	);
}

export function TabsContent({
	value,
	className,
	children,
	...rest
}: {
	value: string;
	className?: string;
	children: ReactNode;
} & Omit<
	ComponentPropsWithoutRef<typeof BaseTabs.Panel>,
	"value" | "children"
>) {
	return (
		<BaseTabs.Panel
			className={cn("mt-4 outline-none", className)}
			value={value}
			{...rest}
		>
			{children}
		</BaseTabs.Panel>
	);
}
