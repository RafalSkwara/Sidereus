import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { CircleAlert, Search } from "lucide-react";
import { filterMessier, type MessierOption } from "@/lib/observations/messier-search";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  /** Built by the page (localised names included), so the catalogue JSON stays out of the bundle. */
  options: readonly MessierOption[];
  /** The object chosen so far, e.g. from `?object=` or the entry being edited. */
  initial?: number;
  label: string;
  placeholder: string;
  noMatch: string;
  error?: string;
  onChange: (messier: number | null) => void;
}

const inputBase =
  "w-full rounded-lg border bg-surface py-2 pr-3 pl-10 text-foreground placeholder:text-faint outline-none transition-shadow focus-visible:ring-[3px]";

/**
 * The Messier object picker (roadmap S-07, FR-022): an ARIA 1.2 combobox with a list of matches for a number
 * ("31", "m31") or a name. Arrow keys move through the list, Enter chooses, Escape closes. The choice is posted
 * as the hidden `messier` field; typed text alone never is, so a half-typed name reads as "no object chosen".
 */
export function MessierPicker({ id, options, initial, label, placeholder, noMatch, error, onChange }: Props) {
  const listId = useId();
  const initialOption = options.find((option) => option.messier === initial);
  const [selected, setSelected] = useState<MessierOption | undefined>(initialOption);
  const [text, setText] = useState(initialOption?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Once chosen, the input shows the label; reopening then lists everything rather than only the choice.
  const query = text === selected?.label ? "" : text;
  const matches = useMemo(() => filterMessier(options, query), [options, query]);
  const activeOption = open ? matches.at(active) : undefined;

  useEffect(() => {
    if (!activeOption) return;
    listRef.current?.querySelector(`[data-messier="${activeOption.messier}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeOption]);

  function choose(option: MessierOption) {
    setSelected(option);
    setText(option.label);
    setOpen(false);
    onChange(option.messier);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setActive(0);
        } else {
          setActive((i) => Math.min(i + 1, matches.length - 1));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        // Enter chooses while the list is open; with it closed, the form submits as usual.
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
      <label htmlFor={id} className="text-heading mb-1 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeOption ? `${listId}-${activeOption.messier}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
            if (selected) {
              setSelected(undefined);
              onChange(null);
            }
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            inputBase,
            error
              ? "border-destructive focus-visible:ring-destructive/20"
              : "border-input focus-visible:border-ring focus-visible:ring-ring/50",
          )}
        />
        <input type="hidden" name="messier" value={selected?.messier ?? ""} />
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={label}
          hidden={!open}
          className="border-border bg-surface absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="text-muted-foreground px-3 py-2 text-sm">{noMatch}</li>
          ) : (
            matches.map((option, index) => (
              <li
                key={option.messier}
                id={`${listId}-${option.messier}`}
                data-messier={option.messier}
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
                <span className="text-heading text-sm font-semibold">{option.label}</span>
                <span className="text-muted-foreground text-xs">{option.detail}</span>
              </li>
            ))
          )}
        </ul>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive mt-1 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
