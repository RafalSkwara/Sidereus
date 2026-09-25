import React from "react";
import { Trash2 } from "lucide-react";

interface Props {
  action: string;
  label?: string;
  confirmMessage: string;
}

/** A native POST form to a delete route that asks for confirmation before submitting. */
export default function DeleteButton({ action, label = "Delete", confirmMessage }: Props) {
  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!window.confirm(confirmMessage)) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action={action} onSubmit={handleSubmit}>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-400/30 px-4 py-2 text-sm text-rose-200 transition-colors hover:bg-rose-400/10 sm:w-auto"
      >
        <Trash2 className="size-4" />
        {label}
      </button>
    </form>
  );
}
