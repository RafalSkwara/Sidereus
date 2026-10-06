// Whose stored Tonight copies these are (offline-night-plan, impl review F1). The server renders this fingerprint on
// each Tonight island (`OfflineCopy.astro`, `data-owner`), and the service worker purges every stored copy when a
// commit comes from anyone other than the index's owner. A SHA-256 over an app-specific prefix and the user id, in
// hex: it tells two users apart and cannot be turned back into the id. Never the email or the raw id.

const PREFIX = "sidereus:offline-owner:v1:";

export async function ownerFingerprint(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PREFIX + userId));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
