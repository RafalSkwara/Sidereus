import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Nightfall buttons. `default` is the filled ink (one primary action per screen), `outline` an ink outline,
 * `destructive` a no-go outline, `action` the standalone link or per-item action (ui-user-adjustments: a border in the
 * link colour, a tinted surface and room for an icon; it wraps, so a long label never overflows; use it with `size: "sm"`),
 * `link` an inline link, underlined at rest (hover on `action` moves the border to the link colour and underlines the label). Every size is at least 44 px tall. Focus is a `--ring` outline offset from the
 * button, so it stays visible on the filled ink (red mode paints ink and ring the same red). Disabled swaps to
 * muted colours instead of fading, so the label stays readable.
 * Astro links that act as buttons use `buttonVariants` directly: `<a class={buttonVariants({ variant })}>`.
 */
/** The resting border of a ghost control that must still read as a button (the sky-check answers). */
const RESTING_BORDER_CLASS = "border border-action-border";

const buttonVariants = cva(
  [
    "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg",
    "text-label font-semibold transition",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary whitespace-nowrap text-primary-foreground hover:bg-primary/85 disabled:bg-muted-foreground",
        destructive:
          "border border-destructive/60 bg-transparent whitespace-nowrap text-destructive hover:bg-destructive/10 disabled:border-border disabled:text-muted-foreground",
        outline:
          "border border-primary bg-transparent whitespace-nowrap text-heading hover:bg-accent disabled:border-border disabled:text-muted-foreground",
        secondary:
          "bg-secondary whitespace-nowrap text-secondary-foreground hover:bg-accent disabled:text-muted-foreground",
        ghost: "whitespace-nowrap text-heading hover:bg-accent disabled:text-muted-foreground",
        action:
          "border border-action-border bg-action-surface py-2 text-left whitespace-normal text-primary-strong underline-offset-4 hover:border-primary-strong hover:underline disabled:border-border disabled:bg-transparent disabled:text-muted-foreground",
        link: "whitespace-nowrap text-primary-strong underline decoration-1 underline-offset-4 hover:decoration-2 disabled:text-muted-foreground",
      },
      size: {
        default: "px-5 has-[>svg]:px-4",
        sm: "gap-1.5 px-3 has-[>svg]:px-2.5",
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

export { Button, buttonVariants, RESTING_BORDER_CLASS };
