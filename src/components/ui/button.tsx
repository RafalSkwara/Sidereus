import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Nightfall buttons. `default` is the filled ink (one primary action per screen), `outline` an ink outline,
 * `destructive` a no-go outline. Every size is at least 44 px tall. Focus is a `--ring` outline offset from the
 * button, so it stays visible on the filled ink (red mode paints ink and ring the same red). Disabled swaps to
 * muted colours instead of fading, so the label stays readable.
 * Astro links that act as buttons use `buttonVariants` directly: `<a class={buttonVariants({ variant })}>`.
 */
const buttonVariants = cva(
  [
    "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg whitespace-nowrap",
    "text-label font-semibold transition",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85 disabled:bg-muted-foreground",
        destructive:
          "border border-destructive/60 bg-transparent text-destructive hover:bg-destructive/10 disabled:border-border disabled:text-muted-foreground",
        outline:
          "border border-primary bg-transparent text-heading hover:bg-accent disabled:border-border disabled:text-muted-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent disabled:text-muted-foreground",
        ghost: "text-heading hover:bg-accent disabled:text-muted-foreground",
        link: "text-primary-strong underline-offset-4 hover:underline disabled:text-muted-foreground",
      },
      size: {
        default: "h-11 px-5 has-[>svg]:px-4",
        sm: "gap-1.5 px-3 text-sm has-[>svg]:px-2.5",
        lg: "h-12 px-6 has-[>svg]:px-5",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
