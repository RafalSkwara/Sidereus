import type { Locale } from "@/lib/preferences";
import { en, type PluralForms } from "./messages/en";
import { pl } from "./messages/pl";

/**
 * The typed message catalogue (F-03). English is the source of truth; every other locale must have
 * exactly the same keys and kinds, which `satisfies Messages` enforces at compile time.
 *
 * Island-safe and dependency-free: pages call `getMessages(Astro.locals.locale)`, islands receive
 * `locale` as a prop and call it themselves.
 */

export type { PluralForms };

/** `typeof en` with every literal string widened to `string`, so a translation can differ. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => unknown
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof en>;

/** Dotted paths to the catalogue's string leaves, e.g. "errors.site.latitudeRange". */
type StringKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends (...args: never[]) => unknown
      ? never
      : T[K] extends readonly unknown[]
        ? never
        : StringKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = StringKeys<typeof en>;

const CATALOGUES: Record<Locale, Messages> = { en, pl };

export function getMessages(locale: Locale): Messages {
  return CATALOGUES[locale];
}

/** Picks the plural form for `n` by the locale's `Intl.PluralRules`; a missing category uses `other`. */
export function plural<T>(locale: Locale, n: number, forms: PluralForms<T>): T {
  const category = new Intl.PluralRules(locale).select(n);
  switch (category) {
    case "one":
      return forms.one;
    case "few":
      return forms.few ?? forms.other;
    case "many":
      return forms.many ?? forms.other;
    default:
      return forms.other;
  }
}

/** The string leaf at a dotted path, own properties only, or `undefined`. */
function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || !Object.hasOwn(node, part)) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Whether `key` names a string message; routes use it to keep `?error=` within the fixed set. */
export function isMessageKey(key: string): key is MessageKey {
  return lookup(en, key) !== undefined;
}

/**
 * Resolves a dotted key that arrived from outside the type system (a `?error=` value, a zod issue
 * message, a store message). Anything that is not a string message, including free text, yields
 * the fallback, so the page never echoes what the URL carries.
 */
export function translateKey(messages: Messages, key: string, fallbackKey: MessageKey): string {
  return lookup(messages, key) ?? lookup(messages, fallbackKey) ?? fallbackKey;
}
