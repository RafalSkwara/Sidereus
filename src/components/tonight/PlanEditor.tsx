import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type SubmitEvent } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { TargetPicker } from "@/components/observations/TargetPicker";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import type { TargetOption } from "@/lib/observations/target-search";
import { SESSION_PLAN_MAX_TARGETS } from "@/lib/session-plans/schemas";
import type { TargetKey } from "@/lib/targets";
import {
  canAdd,
  editPlan,
  editorAnnouncement,
  editorHints,
  isUnchanged,
  savedKeys,
  type EditorEntry,
  type EditorRow,
  type PlanEditorAction,
  type PlanEditorState,
} from "@/lib/tonight/plan-editor";

interface Props {
  locale: Locale;
  /** The user's own site and tonight's night date (`view.date`): the hidden fields of the save form. */
  siteId: string;
  night: string;
  /** The plan's rows in order, as the page words them (`planEditorData`). */
  rows: readonly EditorRow[];
  /**
   * What "add" may offer: the picker's options (tonight's candidates and the current rows), each `detail` its window,
   * built and worded on the server. Whatever is already on the list is left out.
   */
  candidates: readonly TargetOption[];
  /** Saved targets with no window tonight (D4): listed apart, removable, never a row. */
  notTonight: readonly EditorEntry[];
  /** For the `/design` specimens: start with the editor open. */
  defaultOpen?: boolean;
}

type Control = "move-up" | "move-down" | "remove";
/** Where focus goes once the next render has the new list: a row's control, the list itself or the Add button. */
type FocusRequest = { kind: "control"; control: Control; key: string } | { kind: "list" } | { kind: "add" };

/**
 * An edge Move button is `aria-disabled` and stays focusable, so focus is never lost to the page when a row reaches the
 * top or bottom; `quiet` mutes it. Muted is only a colour (in light barely one: about 1.1:1 against the enabled icon),
 * so in every theme the muted icon also gets a dashed box in `--control-border` (3:1 on the ground and the surface):
 * shape, not colour, tells it from an enabled one (F5, WCAG 1.4.1). Here rather than in `quiet`, whose offline
 * `aria-disabled` links stay boxless (`global.css`).
 */
const MOVE_CLASS = "aria-disabled:border aria-disabled:border-dashed aria-disabled:border-control-border";

/** The plan area (`PlanPageContent`'s wrapper) hides the timeline and the "Edited" line while this marker is on it. */
const PLAN_AREA = "[data-session-plan-area]";

/**
 * The Session plan editor (adjustable-session-plan, D6, F7): "Edit plan" opens a list of the plan's rows with Move up,
 * Move down and Remove on each, the saved targets with no window tonight, an "Add a target" picker and one Save (a plain
 * form POST to `/api/tonight/plan` with the keys in order) or Cancel. The state is the pure reducer `editPlan`
 * (`plan-editor.ts`); this component draws it and moves focus. While it is open the plan area carries `data-editing`,
 * which hides the timeline and the "Edited" line (two lists of the same targets are a lot on a phone).
 *
 * Only Edit and Save need the network (`data-needs-network`): Cancel, Move, Remove and Add work offline, so the editor
 * can always be closed. The picker sits outside the save form, so Enter in it never saves: Enter chooses an option and
 * the Add button puts it on the list. Focus: opening goes to the list and Cancel back to Edit; after a move it stays on
 * the moved row's same control (an edge Move is `aria-disabled`, never `disabled`, so it keeps focus); after Remove it
 * goes to the next entry's Remove, else to the list; after Add it stays on Add (the list when it is now full), so the
 * picker's list does not open over the page. Since focus stays put, a visually hidden `role="status"` region says what
 * each Move, Remove and Add did (`editorAnnouncement`, F6); it starts empty, so opening announces nothing. Save stays
 * disabled while the list is the one the editor opened with (`isUnchanged`, F10 c), with a visible line saying why that
 * is also its description (a disabled button leaves the tab order, the line does not).
 */
export default function PlanEditor({
  locale,
  siteId,
  night,
  rows,
  candidates,
  notTonight,
  defaultOpen = false,
}: Props) {
  const t = getMessages(locale).tonight.pages.plan;
  const pickerId = useId();
  const unchangedId = useId();
  const [initial] = useState<PlanEditorState>(() => ({ rows: [...rows], notTonight: [...notTonight] }));
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState(defaultOpen);
  const [picked, setPicked] = useState<TargetKey | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const focusRequest = useRef<FocusRequest | null>(null);
  const firstRun = useRef(true);

  const options = useMemo(() => {
    const present = new Set(savedKeys(state));
    return candidates.filter((option) => !present.has(option.key));
  }, [candidates, state]);
  const hints = useMemo(() => editorHints(state.rows), [state.rows]);
  const unchanged = isUnchanged(initial, state);

  // A focus request runs once the DOM has the new list.
  useLayoutEffect(() => {
    const request = focusRequest.current;
    focusRequest.current = null;
    if (!request || !open) return;
    if (request.kind === "list") {
      listRef.current?.focus();
    } else if (request.kind === "add") {
      (addRef.current ?? listRef.current)?.focus();
    } else {
      rootRef.current
        ?.querySelector<HTMLElement>(`[data-editor-control="${request.control}"][data-key="${request.key}"]`)
        ?.focus();
    }
  });

  // The plan area this editor sits in hides its timeline and "Edited" line while the editor is open.
  useEffect(() => {
    const area = rootRef.current?.closest(PLAN_AREA);
    area?.toggleAttribute("data-editing", open);
    return () => {
      area?.removeAttribute("data-editing");
    };
  }, [open]);

  // Opening puts focus on the list; closing (never at load) returns it to the Edit button.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (open) listRef.current?.focus();
    else editRef.current?.focus();
  }, [open]);

  // A page restored from the back/forward cache after a save starts idle again.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setSubmitting(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Every event re-renders before the next one, so `state` is current here.
  function apply(action: PlanEditorAction) {
    const next = editPlan(state, action);
    setState(next);
    const said = editorAnnouncement(t, state, action, next);
    if (said !== null) setAnnouncement(said);
  }

  function move(key: string, direction: "move-up" | "move-down", edge: boolean) {
    if (edge) return;
    focusRequest.current = { kind: "control", control: direction, key };
    apply({ type: direction, key });
  }

  function remove(key: string) {
    const entries = [...state.rows, ...state.notTonight];
    const next = entries.at(entries.findIndex((entry) => entry.key === key) + 1);
    focusRequest.current = next ? { kind: "control", control: "remove", key: next.key } : { kind: "list" };
    apply({ type: "remove", key });
  }

  function addPicked() {
    const option = options.find((candidate) => candidate.key === picked);
    if (!option) {
      // Nothing chosen yet: the button leads to the picker rather than failing silently.
      document.getElementById(pickerId)?.focus();
      return;
    }
    // A row removed in this session comes back with its own times and line, so its hint is live again.
    const original = initial.rows.find((row) => row.key === option.key);
    apply({
      type: "add",
      row: original ?? { key: option.key, label: option.label, line: option.detail, bestAt: null, windowEnd: null },
    });
    setPicked(null);
    setPickerKey((n) => n + 1);
    focusRequest.current = { kind: "add" };
  }

  function cancel() {
    setState(initial);
    setAnnouncement("");
    setPicked(null);
    setPickerKey((n) => n + 1);
    setOpen(false);
  }

  // Deferred so the submission has started before the button disables (as the delete dialog does).
  function markSubmitting(event: SubmitEvent<HTMLFormElement>) {
    const native = event.nativeEvent;
    setTimeout(() => {
      if (!native.defaultPrevented) setSubmitting(true);
    }, 0);
  }

  const removeButton = (entry: { key: string; label: string }) => (
    <Button
      type="button"
      variant="quiet"
      size="icon"
      aria-label={t.remove({ name: entry.label })}
      data-editor-control="remove"
      data-key={entry.key}
      onClick={() => {
        remove(entry.key);
      }}
    >
      <Trash2 aria-hidden="true" />
    </Button>
  );

  return (
    <div ref={rootRef} className={open ? "w-full" : undefined} data-plan-editor={open ? "open" : "closed"}>
      <p role="status" className="sr-only" data-plan-editor-status>
        {announcement}
      </p>
      {!open ? (
        <Button
          ref={editRef}
          type="button"
          variant="hairline"
          size="sm"
          data-needs-network=""
          onClick={() => {
            setOpen(true);
          }}
        >
          <Pencil aria-hidden="true" />
          {t.edit}
        </Button>
      ) : (
        <>
          <div
            ref={listRef}
            tabIndex={-1}
            role="group"
            aria-label={t.editorListLabel}
            className="focus-visible:outline-ring rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
            data-plan-editor-list
          >
            {state.rows.length === 0 ? (
              <p className="text-body text-muted-foreground py-2" data-plan-editor-empty>
                {t.editorEmpty}
              </p>
            ) : (
              <ol className="border-border border-t">
                {state.rows.map((row, index) => {
                  const first = index === 0;
                  const last = index === state.rows.length - 1;
                  return (
                    <li
                      key={row.key}
                      data-plan-editor-row={row.key}
                      className="border-border flex items-start gap-1 border-b py-2"
                    >
                      <div className="min-w-0 flex-1 py-2">
                        <p className="text-body text-heading min-w-0 font-semibold break-words">{row.label}</p>
                        <p className="text-label text-muted-foreground mt-1 break-words tabular-nums">{row.line}</p>
                        {hints[index] && (
                          <p className="text-label text-muted-foreground mt-1" data-plan-editor-hint>
                            {t.endsBeforePrevious}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0">
                        <Button
                          type="button"
                          variant="quiet"
                          size="icon"
                          aria-label={t.moveUp({ name: row.label })}
                          aria-disabled={first || undefined}
                          data-editor-control="move-up"
                          data-key={row.key}
                          className={MOVE_CLASS}
                          onClick={() => {
                            move(row.key, "move-up", first);
                          }}
                        >
                          <ArrowUp aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="quiet"
                          size="icon"
                          aria-label={t.moveDown({ name: row.label })}
                          aria-disabled={last || undefined}
                          data-editor-control="move-down"
                          data-key={row.key}
                          className={MOVE_CLASS}
                          onClick={() => {
                            move(row.key, "move-down", last);
                          }}
                        >
                          <ArrowDown aria-hidden="true" />
                        </Button>
                        {removeButton(row)}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {state.notTonight.length > 0 && (
              <div className="mt-6" data-plan-editor-not-tonight>
                <p className="text-label text-muted-foreground font-semibold">{t.notTonightHeading}</p>
                <p className="text-label text-muted-foreground mt-1">{t.notTonightHint}</p>
                <ul aria-label={t.notTonightHeading} className="border-border mt-2 border-t">
                  {state.notTonight.map((entry) => (
                    <li
                      key={entry.key}
                      data-plan-editor-not-tonight-key={entry.key}
                      className="border-border flex items-center gap-1 border-b py-1"
                    >
                      <span className="text-label text-muted-foreground min-w-0 flex-1 break-words">{entry.label}</span>
                      {removeButton(entry)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-6" data-plan-editor-add>
            {canAdd(state) ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <TargetPicker
                    key={pickerKey}
                    id={pickerId}
                    options={options}
                    label={t.addLabel}
                    placeholder={t.addPlaceholder}
                    noMatch={t.addNoMatch}
                    onChange={setPicked}
                  />
                </div>
                <Button
                  ref={addRef}
                  type="button"
                  variant="hairline"
                  size="sm"
                  className="self-start sm:self-auto"
                  onClick={addPicked}
                >
                  <Plus aria-hidden="true" />
                  {t.add}
                </Button>
              </div>
            ) : (
              <p className="text-label text-muted-foreground">{t.addFull({ max: String(SESSION_PLAN_MAX_TARGETS) })}</p>
            )}
          </div>

          <form
            method="POST"
            action="/api/tonight/plan"
            onSubmit={markSubmitting}
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2"
            data-plan-editor-save
          >
            <input type="hidden" name="site" value={siteId} />
            <input type="hidden" name="night" value={night} />
            {savedKeys(state).map((key) => (
              <input key={key} type="hidden" name="targets" value={key} />
            ))}
            {/* `aria-describedby` never changes (a missing id is ignored), so a render never drops the offline description. */}
            <Button
              type="submit"
              data-needs-network=""
              disabled={submitting || unchanged}
              aria-busy={submitting}
              aria-describedby={unchangedId}
            >
              <Save aria-hidden="true" />
              {t.save}
            </Button>
            <Button type="button" variant="quiet" size="bare" onClick={cancel}>
              <X aria-hidden="true" />
              {t.cancel}
            </Button>
            {unchanged && (
              <p id={unchangedId} className="text-label text-muted-foreground basis-full" data-plan-editor-unchanged>
                {t.saveUnchanged}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
