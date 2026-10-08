import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/*
 * The gear card's select: the shared `NativeSelect`, the active item selected. Its visible label is the card's title
 * (a `<label for>` in `GearCard.astro`), so there is no second label here. A React component so the options render
 * inside the select itself (an Astro slot would wrap them in an `astro-static-slot` element); GearCard renders it on
 * the server only, without a client directive. Only ids and names come in, never a site's coordinates.
 */
interface GearSelectFieldProps {
  /** The id the card's `<label for>` points at. */
  id: string;
  /** The page query parameter the pick travels in. */
  name: "site" | "telescope";
  /** In `created_at` order. */
  items: { id: string; name: string }[];
  activeId: string;
}

export default function GearSelectField({ id, name, items, activeId }: GearSelectFieldProps) {
  return (
    <NativeSelect id={id} name={name} defaultValue={activeId}>
      {items.map((item) => (
        <NativeSelectOption key={item.id} value={item.id}>
          {item.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
