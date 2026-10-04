import { useId, useRef, type MouseEvent } from "react";
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
 */
export default function DeleteButton({ action, label, confirmMessage, cancelLabel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const messageId = useId();

  function openDialog(e: MouseEvent<HTMLButtonElement>) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    e.preventDefault();
    dialog.showModal();
    cancelRef.current?.focus();
  }

  return (
    <form method="POST" action={action}>
      <Button type="submit" variant="destructive" className="w-full sm:w-auto" onClick={openDialog}>
        <Trash2 className="size-4" />
        {label}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={messageId}
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
            onClick={() => {
              dialogRef.current?.close();
            }}
          >
            {cancelLabel}
          </Button>
          <Button type="submit" variant="destructive">
            <Trash2 className="size-4" />
            {label}
          </Button>
        </div>
      </dialog>
    </form>
  );
}
