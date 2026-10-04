import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/*
 * The GearSelector dropdown's field: the shared `Label` over the shared `NativeSelect`, the active item selected.
 * A React component so the options render inside the select itself (an Astro slot would wrap them in an
 * `astro-static-slot` element); GearSelector renders it on the server only, without a client directive. Only ids and
 * names come in, never a site's coordinates.
 */
interface GearSelectFieldProps {
  id: string;
  /** The page query parameter the pick travels in. */
  name: "site" | "telescope";
  label: string;
  /** In `created_at` order. */
  items: { id: string; name: string }[];
  activeId: string;
}

export default function GearSelectField({ id, name, label, items, activeId }: GearSelectFieldProps) {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} name={name} defaultValue={activeId}>
        {items.map((item) => (
          <NativeSelectOption key={item.id} value={item.id}>
            {item.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
