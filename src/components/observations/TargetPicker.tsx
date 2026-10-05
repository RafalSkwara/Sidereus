import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { FieldError } from "@/components/forms/FormField";
import { fieldClass } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filterTargets, type TargetOption } from "@/lib/observations/target-search";
import type { TargetKey } from "@/lib/targets";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  /** Built by the page (localised names included), so the catalogue JSON stays out of the bundle. */
  options: readonly TargetOption[];
  /** The target chosen so far, e.g. from `?object=` or the entry being edited. */
  initial?: TargetKey;
  label: string;
  placeholder: string;
  noMatch: string;
  error?: string;
  onChange: (target: TargetKey | null) => void;
}

/** No option is highlighted: the list is open for browsing, and Enter submits the form rather than choosing. */
const NONE = -1;

/**
 * The object picker (roadmap S-07, FR-022; planets since M-2 S-01): an ARIA 1.2 combobox with a list of matches for
 * a Messier number ("31", "m31") or a name. Arrow keys move through the list, Enter chooses, Escape closes. The
 * choice is posted as the hidden `target` field (a target key); typed text alone never is, so a half-typed name reads
 * as "no object chosen".
 */
export function TargetPicker({ id, options, initial, label, placeholder, noMatch, error, onChange }: Props) {
  const listId = useId();
  const initialOption = options.find((option) => option.key === initial);
  const [selected, setSelected] = useState<TargetOption | undefined>(initialOption);
  const [text, setText] = useState(initialOption?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(NONE);
  const listRef = useRef<HTMLUListElement>(null);

  // Once chosen, the input shows the label; reopening then lists everything rather than only the choice.
  const query = text === selected?.label ? "" : text;
  const matches = useMemo(() => filterTargets(options, query), [options, query]);
  // Only an option the user moved to (by typing or the arrow keys) is active; opening the list highlights nothing.
  const activeOption = open && active !== NONE ? matches.at(active) : undefined;
  const chosenIndex = selected ? matches.indexOf(selected) : NONE;

  useEffect(() => {
    if (!activeOption) return;
    listRef.current?.querySelector(`[data-target="${activeOption.key}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeOption]);

  function choose(option: TargetOption) {
    setSelected(option);
    setText(option.label);
    setOpen(false);
    onChange(option.key);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setOpen(true);
        // The first press lands on the current choice (or the first match), later ones move down.
        setActive((i) => (!open || i === NONE ? Math.max(chosenIndex, 0) : Math.min(i + 1, matches.length - 1)));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (i === NONE ? Math.max(chosenIndex, 0) : Math.max(i - 1, 0)));
        break;
      case "Enter":
        // Enter chooses the highlighted option; with none highlighted, the form submits as usual.
        if (activeOption) {
          e.preventDefault();
          choose(activeOption);
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
          aria-autocomplete="list"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeOption ? `${listId}-${activeOption.key}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            // Typing highlights the best match, so Enter takes it; clearing the field highlights nothing.
            setActive(e.target.value.trim() === "" ? NONE : 0);
            if (selected) {
              setSelected(undefined);
              onChange(null);
            }
          }}
          onFocus={() => {
            setOpen(true);
            setActive(NONE);
          }}
          onBlur={() => {
            setOpen(false);
          }}
          onKeyDown={handleKeyDown}
          className={cn(fieldClass, "pl-10")}
        />
        <input type="hidden" name="target" value={selected?.key ?? ""} />
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={label}
          hidden={!open || matches.length === 0}
          className="border-border bg-surface absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border py-1 shadow-lg"
        >
          {matches.map((option, index) => (
            <li
              key={option.key}
              id={`${listId}-${option.key}`}
              data-target={option.key}
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
              <span className="text-label text-heading font-semibold">{option.label}</span>
              <span className="text-muted-foreground text-sm">{option.detail}</span>
            </li>
          ))}
        </ul>
        {/* Outside the listbox (which may only hold options), always present so the change is announced. */}
        <p
          role="status"
          className={
            open && matches.length === 0
              ? "border-border bg-surface text-muted-foreground absolute z-10 mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-lg"
              : "sr-only"
          }
        >
          {open && matches.length === 0 ? noMatch : ""}
        </p>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
