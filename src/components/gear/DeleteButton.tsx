import { useEffect, useId, useRef, useState, type MouseEvent, type SubmitEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  action: string;
  /** Translated by the page, like `confirmMessage` and `cancelLabel`. */
  label: string;
  confirmMessage: string;
  cancelLabel: string;
}

/*
 * A native POST form to a delete route that asks first in a token-styled modal `<dialog>` (never
 * `window.confirm`, whose OS-drawn dialog flashes white in red night mode). Cancel takes the initial focus;
 * Escape and Cancel close without submitting; the dialog's delete button submits the same form.
 * Before hydration the trigger submits the form directly, as the old confirm path did without JavaScript.
 * Once the delete is submitted, both dialog buttons disable so a second click can't send it twice; a page restored
 * from the back/forward cache starts idle again.
 */
export default function DeleteButton({ action, label, confirmMessage, cancelLabel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const messageId = useId();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSubmitting(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Deferred so the submission has started before the buttons disable.
  function markSubmitting(e: SubmitEvent<HTMLFormElement>) {
    const native = e.nativeEvent;
    setTimeout(() => {
      if (!native.defaultPrevented) setSubmitting(true);
    }, 0);
  }

  function openDialog(e: MouseEvent<HTMLButtonElement>) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    e.preventDefault();
    dialog.showModal();
    cancelRef.current?.focus();
  }

  return (
    <form method="POST" action={action} onSubmit={markSubmitting}>
      <Button type="submit" variant="destructive" className="w-full sm:w-auto" onClick={openDialog}>
        <Trash2 className="size-4" />
        {label}
      </Button>
      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-label={label}
        aria-describedby={messageId}
        className="border-border bg-surface text-foreground backdrop:bg-background/80 m-auto w-11/12 max-w-sm rounded-xl border p-5 shadow-2xl"
      >
        <p id={messageId} className="text-body text-heading">
          {confirmMessage}
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
            {cancelLabel}
          </Button>
          <Button type="submit" variant="destructive" disabled={submitting} aria-busy={submitting}>
            {submitting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {label}
          </Button>
        </div>
      </dialog>
    </form>
  );
}
