import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
import type { MessageKey } from "@/i18n";

/** A missing piece of configuration, shown as a banner by the layout. Texts are message keys. */
export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: MessageKey;
  docsUrl?: string;
  docsLabel?: MessageKey;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: "config.supabase.message",
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: "config.supabase.docsLabel",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
