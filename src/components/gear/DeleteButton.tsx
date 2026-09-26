import React from "react";
import { Trash2 } from "lucide-react";

interface Props {
  action: string;
  /** Translated by the page, like `confirmMessage`. */
  label: string;
  confirmMessage: string;
}

/** A native POST form to a delete route that asks for confirmation before submitting. */
export default function DeleteButton({ action, label, confirmMessage }: Props) {
  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!window.confirm(confirmMessage)) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action={action} onSubmit={handleSubmit}>
      <button
        type="submit"
        className="border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors sm:w-auto"
      >
        <Trash2 className="size-4" />
        {label}
      </button>
    </form>
  );
}
