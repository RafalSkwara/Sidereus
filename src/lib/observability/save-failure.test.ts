import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { getMessages, isMessageKey, translateKey } from "@/i18n";

import { saveFailureKey } from "./save-failure";

/**
 * `saveFailureKey` is the one call every save route makes on a failed write: it logs what the result's fault says
 * and picks the `?error=` key. A server fault is the only one that is an error-level line and the neutral key.
 */

const ENTITY_KEY = "errors.save.site" as const;

let errors: MockInstance<typeof console.error>;
let warns: MockInstance<typeof console.warn>;

beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  warns = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  errors.mockRestore();
  warns.mockRestore();
});

describe("saveFailureKey", () => {
  it("answers a server fault with the neutral key and one error-level line holding its code and status", () => {
    const key = saveFailureKey("save.gear", {
      message: ENTITY_KEY,
      fault: { kind: "server", code: "08006", status: 503 },
    });
    expect(key).toBe("errors.serverFault");
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("sidereus: save.gear failed", {
      step: "save.gear",
      code: "08006",
      status: 503,
    });
    expect(warns).not.toHaveBeenCalled();
  });

  it("logs a server fault with no code or status as just its step (a network failure or a timeout)", () => {
    expect(saveFailureKey("save.log", { message: ENTITY_KEY, fault: { kind: "server" } })).toBe("errors.serverFault");
    expect(errors).toHaveBeenCalledWith("sidereus: save.log failed", { step: "save.log" });
  });

  it.each([
    ["refused", { kind: "refused", code: "42501" }, { step: "save.plan", code: "42501" }],
    [
      "session",
      { kind: "session", code: "PGRST301", status: 401 },
      { step: "save.plan", code: "PGRST301", status: 401 },
    ],
    ["no-rows", { kind: "no-rows" }, { step: "save.plan" }],
  ] as const)(
    "answers a %s fault with the entity key and one warn-level notice, never an error line",
    (_kind, fault, fields) => {
      expect(saveFailureKey("save.plan", { message: ENTITY_KEY, fault })).toBe(ENTITY_KEY);
      expect(warns).toHaveBeenCalledTimes(1);
      expect(warns).toHaveBeenCalledWith("sidereus: save.plan noted", fields);
      expect(errors).not.toHaveBeenCalled();
    },
  );

  it("answers a user mistake (a result with no fault) with the entity key and no line at all", () => {
    expect(saveFailureKey("save.sky-check", { message: "errors.outOfRange" })).toBe("errors.outOfRange");
    expect(errors).not.toHaveBeenCalled();
    expect(warns).not.toHaveBeenCalled();
  });

  it("keeps any value out of the line even when the fault object carries extra properties", () => {
    const fault = Object.assign(
      { kind: "server" as const, code: "08006" },
      { message: "lat=52.2297 ada.lovelace@example.test", details: "52.2297,21.0122" },
    );
    saveFailureKey("save.gear", { message: ENTITY_KEY, fault });
    expect(JSON.stringify(errors.mock.calls)).not.toMatch(/52\.2297|21\.0122|ada\.lovelace|example\.test/);
  });
});

describe("errors.serverFault", () => {
  it("is a message key with neutral copy in both languages", () => {
    expect(isMessageKey("errors.serverFault")).toBe(true);
    expect(translateKey(getMessages("en"), "errors.serverFault", "errors.generic")).toBe(
      "Something went wrong on our side, so nothing was changed. Try again in a moment.",
    );
    expect(translateKey(getMessages("pl"), "errors.serverFault", "errors.generic")).toBe(
      "Coś poszło nie tak po naszej stronie, więc nic nie zostało zmienione. Spróbuj ponownie za chwilę.",
    );
  });
});
