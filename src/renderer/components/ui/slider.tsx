import * as SliderPrimitive from "@radix-ui/react-slider";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

export const Slider = forwardRef<
	React.ElementRef<typeof SliderPrimitive.Root>,
	SliderProps
>(({ className, ...props }, ref) => {
	const valueCount = (props.value ?? props.defaultValue ?? [0]).length || 1;
	return (
		<SliderPrimitive.Root
			ref={ref}
			className={cn(
				"relative flex w-full touch-none select-none items-center disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
				<SliderPrimitive.Range className="absolute h-full bg-primary/80" />
			</SliderPrimitive.Track>
			{Array.from({ length: valueCount }).map((_, i) => (
				<SliderPrimitive.Thumb
					key={i}
					className="glow-xs block h-4 w-4 rounded-full bg-primary ring-1 ring-foreground/15 transition-all duration-200 ease-out hover:scale-110 hover:glow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50"
				/>
			))}
		</SliderPrimitive.Root>
	);
});
Slider.displayName = "Slider";
