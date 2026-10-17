export type ScenarioName = "evening" | "deepNight" | "civilDawn" | "daytime" | "fullMoonEvening" | "noDarkness";
export const SCENARIOS: Record<ScenarioName, string>;
export const DEFAULT_SCENARIO: ScenarioName;
export const FIXTURE_HOURS_BEFORE: number;
export const FIXTURE_HOURS_AFTER: number;
export function fixtureHours(nowMs?: number): number[];
