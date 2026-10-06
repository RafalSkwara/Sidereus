import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { FieldError } from "@/components/forms/FormField";
import { fieldClass } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ComboboxStatus {
  /** Shown when the query matches nothing. */
  noMatch: string;
  /** Shown while the options are still loading. */
  loading: string;
  /** Shown when the options could not be loaded. */
  unavailable: string;
  /** Shown (visibly) under a capped list; `hidden` is how many matches are not listed. Numbers are formatted by the host. */
  more: (hidden: number) => string;
  /** What a screen reader hears for a capped list: stable text with no count, so typing does not re-announce it. */
  keepTyping: string;
}

interface Props<T> {
  id: string;
  label: string;
  placeholder: string;
  options: readonly T[];
  /** `loading` and `unavailable` list nothing and say why in the status line; the host's own fields stay usable. */
  state: "loading" | "ready" | "unavailable";
  /** The input's text. Controlled, so a host can clear it (after the user picks something else, say). */
  text: string;
  /** Called when the user types, never when an option is chosen: the host sets the text in `onSelect`. */
  onTextChange: (text: string) => void;
  /** The options matching `query`, best first. Keep it a stable reference (module scope or memoised). */
  filter: (options: readonly T[], query: string) => readonly T[];
  getKey: (option: T) => string;
  /** What the input shows once the option is chosen. */
  getLabel: (option: T) => string;
  /** The row's secondary line; empty hides it. */
  getDetail: (option: T) => string;
  onSelect: (option: T) => void;
  /** The label of the option chosen before the user touched the field, so reopening lists everything. */
  initialLabel?: string;
  /** A line under the input, e.g. "Not listed? Fill in below.". */
  hint?: string;
  status: ComboboxStatus;
  /** The list shows at most this many rows (default 50); the status line tells the user to keep typing. */
  maxResults?: number;
  error?: string;
  disabled?: boolean;
  /** For the `/design` state cells: start open, with this row highlighted. */
  defaultOpen?: boolean;
  defaultActive?: number;
  /**
   * Whether Enter in the input may submit the host form when no option is highlighted (default false: a search box
   * that never posts never saves by accident). The log's target picker sets it, as its tested flow submits that way.
   */
  submitOnEnter?: boolean;
  /** Extra classes for the input, for the `/design` focus specimen. */
  inputClassName?: string;
}

/** No option is highlighted: the list is open for browsing, and Enter chooses nothing. */
const NONE = -1;

/**
 * The shared ARIA 1.2 combobox (gear-catalogue; generalised from the log's object picker): an input with
 * `role="combobox"` and a listbox of matches. Arrow keys move through the list, Enter chooses, Escape closes. The
 * input has no `name`, so typed text never posts; the host's own fields carry the form. Enter chooses the highlighted
 * option; with none highlighted it does nothing, unless the host opts in with `submitOnEnter` (then the form submits).
 */
export function Combobox<T>({
  id,
  label,
  placeholder,
  options,
  state,
  text,
  onTextChange,
  filter,
  getKey,
  getLabel,
  getDetail,
  onSelect,
  initialLabel,
  hint,
  status,
  maxResults = 50,
  error,
  disabled,
  defaultOpen = false,
  defaultActive = NONE,
  submitOnEnter = false,
  inputClassName,
}: Props<T>) {
  const listId = useId();
  const [chosenLabel, setChosenLabel] = useState(initialLabel);
  const [open, setOpen] = useState(defaultOpen);
  const [active, setActive] = useState(defaultActive);
  const listRef = useRef<HTMLUListElement>(null);

  // Once chosen, the input shows the label; reopening then lists everything rather than only the choice.
  const query = text === chosenLabel ? "" : text;
  const ready = state === "ready";
  const matches = useMemo(() => (ready ? filter(options, query) : []), [ready, filter, options, query]);
  const shown = useMemo(() => matches.slice(0, maxResults), [matches, maxResults]);
  const hidden = matches.length - shown.length;
  // Only an option the user moved to (by typing or the arrow keys) is active; opening the list highlights nothing.
  const activeOption = open && active !== NONE ? shown.at(active) : undefined;
  const chosenIndex = chosenLabel === undefined ? NONE : shown.findIndex((option) => getLabel(option) === chosenLabel);
  const showList = open && shown.length > 0;

  // `message` is what the live region holds. A capped list announces only that it is capped (the same text for every
  // keystroke, so it is read once); the changing count is `visibleMore`, outside the live region.
  let message = "";
  let visibleMore = "";
  if (open) {
    if (state === "loading") message = status.loading;
    else if (state === "unavailable") message = status.unavailable;
    else if (matches.length === 0) message = status.noMatch;
    else if (hidden > 0) {
      message = status.keepTyping;
      visibleMore = status.more(hidden);
    }
  }

  useEffect(() => {
    if (!activeOption) return;
    listRef.current?.children.item(active)?.scrollIntoView({ block: "nearest" });
  }, [activeOption, active]);

  function choose(option: T) {
    setChosenLabel(getLabel(option));
    setOpen(false);
    onSelect(option);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setOpen(true);
        // The first press lands on the current choice (or the first match), later ones move down.
        setActive((i) => (!open || i === NONE ? Math.max(chosenIndex, 0) : Math.min(i + 1, shown.length - 1)));
        break;
      case "ArrowUp":
        e.preventDefault();
        setOpen(true);
        setActive((i) => (!open || i === NONE ? Math.max(chosenIndex, 0) : Math.max(i - 1, 0)));
        break;
      case "Enter":
        // Enter chooses the highlighted option; with none highlighted it submits only for a host that asked for that.
        if (activeOption) {
          e.preventDefault();
          choose(activeOption);
        } else if (!submitOnEnter) {
          e.preventDefault();
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
    }
  }

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <Label htmlFor={id} className="mb-1.5">
        {label}
      </Label>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={activeOption ? `${listId}-${getKey(activeOption)}` : undefined}
          aria-busy={state === "loading" ? true : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            onTextChange(e.target.value);
            setOpen(true);
            // Typing highlights the best match, so Enter takes it; clearing the field highlights nothing.
            setActive(e.target.value.trim() === "" ? NONE : 0);
            setChosenLabel(undefined);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(NONE);
          }}
          onClick={() => {
            // A click on the focused input (after Escape, say) reopens the list; focus alone does not fire again.
            setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
          }}
          onKeyDown={handleKeyDown}
          className={cn(fieldClass, "pl-10", inputClassName)}
        />
        {/* The status line sits outside the listbox (which may only hold options) and is always present, so a change is announced. */}
        <div
          className={cn(
            message || visibleMore || showList
              ? "border-border bg-surface absolute z-10 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
              : "sr-only",
          )}
        >
          <ul
            id={listId}
            ref={listRef}
            role="listbox"
            aria-label={label}
            hidden={!showList}
            className="max-h-72 overflow-y-auto py-1"
          >
            {shown.map((option, index) => {
              const detail = getDetail(option);
              return (
                <li
                  key={getKey(option)}
                  id={`${listId}-${getKey(option)}`}
                  role="option"
                  aria-selected={index === active}
                  // Keep focus in the input so the click chooses instead of blurring the list away.
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    choose(option);
                  }}
                  onMouseEnter={() => {
                    setActive(index);
                  }}
                  className={cn(
                    "flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5",
                    index === active && "bg-accent",
                  )}
                >
                  <span className="text-label text-heading font-semibold">{getLabel(option)}</span>
                  {detail && <span className="text-muted-foreground text-sm">{detail}</span>}
                </li>
              );
            })}
          </ul>
          <p
            role="status"
            className={cn(
              visibleMore ? "sr-only" : "text-muted-foreground text-sm",
              message && !visibleMore && "px-3 py-2",
              showList && message && !visibleMore && "border-border border-t",
            )}
          >
            {message}
          </p>
          {visibleMore && (
            <p
              aria-hidden="true"
              className={cn("text-muted-foreground px-3 py-2 text-sm", showList && "border-border border-t")}
            >
              {visibleMore}
            </p>
          )}
        </div>
      </div>
      {hint && (
        <p id={hintId} className="text-muted-foreground mt-1.5 text-sm">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
