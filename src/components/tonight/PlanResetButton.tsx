import { useEffect, useId, useRef, useState, type MouseEvent, type SubmitEvent } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/i18n";
import type { Locale } from "@/lib/preferences";

interface Props {
  locale: Locale;
  /** The user's own site and tonight's night date (`view.date`): the hidden fields of the reset form. */
  siteId: string;
  night: string;
}

/**
 * Reset to the suggested plan (adjustable-session-plan D8): a POST form to `/api/tonight/plan/reset` that asks once in a
 * token-styled modal `<dialog role="alertdialog">` (the pattern of `gear/DeleteButton`, never `window.confirm`, whose
 * OS-drawn dialog flashes white in red night mode). Cancel takes the initial focus; Escape and Cancel close without
 * submitting. The trigger is a plain button, so before hydration it does nothing (it never resets without asking). The
 * trigger and the confirm button need the network (`data-needs-network`): offline the click is swallowed and the dialog
 * never opens. The confirm button is `destructive`, as the delete dialog's (it removes the saved list). Once the reset
 * is submitted both dialog buttons disable, so it cannot be sent twice. Closing (Escape or Cancel) puts focus back on the
 * trigger explicitly (F10 e): Safari otherwise leaves it on `<body>` after a mouse click.
 */
export default function PlanResetButton({ locale, siteId, night }: Props) {
  const t = getMessages(locale).tonight.pages.plan;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const messageId = useId();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setSubmitting(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Deferred so the submission has started before the buttons disable.
  function markSubmitting(event: SubmitEvent<HTMLFormElement>) {
    const native = event.nativeEvent;
    setTimeout(() => {
      if (!native.defaultPrevented) setSubmitting(true);
    }, 0);
  }

  function openDialog(event: MouseEvent<HTMLButtonElement>) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    event.preventDefault();
    dialog.showModal();
    cancelRef.current?.focus();
  }

  return (
    <form method="POST" action="/api/tonight/plan/reset" onSubmit={markSubmitting}>
      <input type="hidden" name="site" value={siteId} />
      <input type="hidden" name="night" value={night} />
      <Button ref={triggerRef} type="button" variant="quiet" size="bare" data-needs-network="" onClick={openDialog}>
        <RotateCcw aria-hidden="true" />
        {t.reset}
      </Button>
      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-label={t.reset}
        aria-describedby={messageId}
        onClose={() => {
          triggerRef.current?.focus();
        }}
        className="border-border bg-surface text-foreground backdrop:bg-background/80 m-auto w-11/12 max-w-sm rounded-xl border p-5 shadow-2xl"
      >
        <p id={messageId} className="text-body text-heading">
          {t.resetConfirm}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => {
              dialogRef.current?.close();
            }}
          >
            {t.resetCancel}
          </Button>
          <Button
            type="submit"
            variant="destructive"
            data-needs-network=""
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : (
              <RotateCcw aria-hidden="true" />
            )}
            {t.resetConfirmYes}
          </Button>
        </div>
      </dialog>
    </form>
  );
}
