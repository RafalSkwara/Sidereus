import { useState } from "react";
import { Combobox } from "@/components/forms/Combobox";
import { filterTargets, type TargetOption } from "@/lib/observations/target-search";
import type { TargetKey } from "@/lib/targets";

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

const getKey = (option: TargetOption) => option.key;
const getLabel = (option: TargetOption) => option.label;
const getDetail = (option: TargetOption) => option.detail;
// The log never loads or caps its list, so only the no-match line is ever shown.
const noStatus = { loading: "", unavailable: "", more: () => "" };

/**
 * The object picker (roadmap S-07, FR-022; planets since M-2 S-01): the shared `Combobox` over the Messier search
 * for a number ("31", "m31") or a name. The choice is posted as the hidden `target` field (a target key); typed text
 * alone never is, so a half-typed name reads as "no object chosen".
 */
export function TargetPicker({ id, options, initial, label, placeholder, noMatch, error, onChange }: Props) {
  const initialOption = options.find((option) => option.key === initial);
  const [selected, setSelected] = useState<TargetOption | undefined>(initialOption);
  const [text, setText] = useState(initialOption?.label ?? "");

  return (
    <div>
      <Combobox
        id={id}
        label={label}
        placeholder={placeholder}
        options={options}
        state="ready"
        text={text}
        onTextChange={(value) => {
          setText(value);
          if (selected) {
            setSelected(undefined);
            onChange(null);
          }
        }}
        filter={filterTargets}
        getKey={getKey}
        getLabel={getLabel}
        getDetail={getDetail}
        onSelect={(option) => {
          setSelected(option);
          setText(option.label);
          onChange(option.key);
        }}
        initialLabel={initialOption?.label}
        status={{ noMatch, ...noStatus }}
        maxResults={Infinity}
        error={error}
      />
      <input type="hidden" name="target" value={selected?.key ?? ""} />
    </div>
  );
}
