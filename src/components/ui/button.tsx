import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Nightfall buttons, a hierarchy of weights (ui-quiet-actions). `default` is the filled ink: one primary action per
 * screen. `outline` is an ink outline and `destructive` a no-go outline. `hairline` is the per-item button (Mark
 * observed): a neutral border at 3:1 (`--control-border`), no fill, a foreground label and link-coloured icons; use it
 * with `size: "sm"`, never on a sky header (the border is too faint there). `quiet` is every other standalone link or
 * action: link-coloured text, no box, always with its icon (in red mode it is underlined at rest, which with the icon
 * tells it apart from an inline link); use it with `size: "bare"`. `link` is an inline link inside a sentence,
 * underlined at rest. Hairline and quiet wrap, so a long Polish label stays inside the column. Every size is at
 * least 44 px tall. Focus is a `--ring` outline offset from the button, so it stays visible on the filled ink (red
 * mode paints ink and ring the same red). Disabled swaps to muted colours instead of fading, so the label stays
 * readable; a disabled link is only ever the offline `aria-disabled` state (`global.css`), and `hairline` and `quiet`
 * style `aria-disabled` like `disabled` (a control that stays focusable, such as a list's Move button at its edge). Astro links that act as buttons use `buttonVariants` directly: `<a class={buttonVariants({ variant })}>`.
 */
/** The resting border of a ghost control that must still read as a button (the sky-check answers). */
const RESTING_BORDER_CLASS = "border border-action-border";

const buttonVariants = cva(
  [
    "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg",
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
        hairline:
          "border border-control-border bg-transparent py-2 text-left whitespace-normal text-foreground [&_svg]:text-primary-strong hover:border-primary-strong hover:bg-accent disabled:border-border disabled:text-muted-foreground disabled:[&_svg]:text-muted-foreground aria-disabled:cursor-not-allowed aria-disabled:border-border aria-disabled:bg-transparent aria-disabled:text-muted-foreground aria-disabled:[&_svg]:text-muted-foreground aria-disabled:hover:border-border aria-disabled:hover:bg-transparent",
        quiet:
          "py-2 text-left whitespace-normal text-primary-strong underline-offset-4 hover:underline red:underline red:hover:decoration-2 disabled:text-muted-foreground aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground aria-disabled:no-underline!",
        link: "whitespace-nowrap text-primary-strong underline decoration-1 underline-offset-4 hover:decoration-2 disabled:text-muted-foreground",
      },
      size: {
        default: "gap-2 px-5 has-[>svg]:px-4",
        sm: "gap-1.5 px-3 has-[>svg]:px-2.5",
        bare: "gap-1.5 px-0",
        lg: "h-12 gap-2 px-6 has-[>svg]:px-5",
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
