import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
}

/*
 * Pending covers both kinds of form: `useFormStatus` for a React function action, and a native POST form (every
 * form here), whose submit is watched on the button's own form. The check waits until the event has finished, so a
 * submit the form's own handler cancels (failed validation) never turns pending; disabling after the submission has
 * started doesn't cancel it, and a second click can't send it twice. A page restored from the back/forward cache
 * starts idle again.
 */
export function SubmitButton({ pendingText, icon, children }: SubmitButtonProps) {
  const { pending: actionPending } = useFormStatus();
  const [submitting, setSubmitting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form) return;
    const onSubmit = (e: SubmitEvent) => {
      setTimeout(() => {
        if (!e.defaultPrevented) setSubmitting(true);
      }, 0);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSubmitting(false);
    };
    form.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const pending = actionPending || submitting;

  return (
    <Button ref={buttonRef} type="submit" disabled={pending} size="lg" className="w-full">
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          {pendingText}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {icon}
          {children}
        </span>
      )}
    </Button>
  );
}
