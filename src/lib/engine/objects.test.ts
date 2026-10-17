import { describe, expect, it } from "vitest";

import { DEEP_SKY } from "@/lib/catalogue";

import { WARSAW, circularDeltaDeg, messierTarget, warsawDarkWindow } from "./fixtures";
import { observingNight } from "./night";
import { bestWindow, objectPosition, objectTrack, objectTracks, refinedWindow } from "./objects";
import type { HorizontalPosition } from "./types";

function highest(track: readonly HorizontalPosition[]): HorizontalPosition {
  return track.reduce((top, sample) => (sample.altitudeDeg > top.altitudeDeg ? sample : top));
}

function sample(minutes: number, altitudeDeg: number): HorizontalPosition {
  return { time: new Date(Date.UTC(2026, 9, 10, 20, minutes)), altitudeDeg, azimuthDeg: 180 };
}

describe("objectPosition / objectTrack (synthetic)", () => {
  const night = observingNight("2026-10-10", WARSAW.timeZone);
  const m31 = messierTarget("M31");

  it("peaks within 1° of the upper-culmination altitude 90 − |φ − δ| and transits within 2° of due south for M31 at Warsaw", () => {
    const track = objectTrack(WARSAW, night, m31);
    const expected = 90 - Math.abs(WARSAW.latitudeDeg - m31.decDeg);
    expect(Math.abs(highest(track).altitudeDeg - expected)).toBeLessThanOrEqual(1);

    // Transit instant from a 1-minute grid: the sampled 10-minute peak is not used because at 79°
    // altitude the azimuth moves about 1° per minute, so a 10-minute grid can sit 5° off.
    const fine = objectTrack(WARSAW, night, m31, 1);
    const transit = highest(fine);
    expect(circularDeltaDeg(transit.azimuthDeg, 180)).toBeLessThanOrEqual(2);
    expect(transit.time.getTime()).toBeGreaterThan(night.start.getTime());
    expect(transit.time.getTime()).toBeLessThan(night.end.getTime());
  });
});

describe("bestWindow", () => {
  it("returns the longest run at or above the threshold with its highest sample, the earlier of two equal runs, and counts a sample exactly at the threshold as inside", () => {
    const longest = [sample(0, 10), sample(10, 35), sample(20, 40), sample(30, 38), sample(40, 20), sample(50, 45)];
    const window = bestWindow(longest, 30);
    expect(window?.start).toEqual(longest[1].time);
    expect(window?.end).toEqual(longest[3].time);
    expect(window?.peak).toEqual(longest[2]);

    const equal = [sample(0, 31), sample(10, 32), sample(20, 5), sample(30, 60), sample(40, 70), sample(50, 5)];
    const earlier = bestWindow(equal, 30);
    expect(earlier?.start).toEqual(equal[0].time);
    expect(earlier?.end).toEqual(equal[1].time);
    expect(earlier?.peak).toEqual(equal[1]);

    const edge = [sample(0, 29.9), sample(10, 30), sample(20, 29.9)];
    const atThreshold = bestWindow(edge, 30);
    expect(atThreshold?.start).toEqual(edge[1].time);
    expect(atThreshold?.end).toEqual(edge[1].time);

    expect(bestWindow([sample(0, 10), sample(10, 20), sample(20, 15)], 30)).toBeNull();
    expect(bestWindow([], 0)).toBeNull();
  });
});

describe("refinedWindow", () => {
  // The refined edge is where the engine's own continuous altitude equals the minimum: within 0.05°, which a 10-minute
  // chord keeps (the curvature of a diurnal track is worst at the horizon, where refraction bends it too).
  it("puts every refined edge of the catalogue within 0.05° of the minimum altitude, at 0°, 15° and 40°", () => {
    const minimums = [0, 15, 40];
    const dark = warsawDarkWindow("2026-10-10", 5);
    const tracks = objectTracks(WARSAW, { start: dark.start, end: dark.end }, DEEP_SKY, 10);
    for (const minAltitudeDeg of minimums) {
      let edges = 0;
      DEEP_SKY.forEach((object, i) => {
        const window = refinedWindow(tracks[i], minAltitudeDeg);
        if (window === null) {
          return;
        }
        for (const edge of [window.start, window.end]) {
          if (edge.getTime() === dark.start.getTime() || edge.getTime() === dark.end.getTime()) {
            continue;
          }
          edges += 1;
          const altitude = objectPosition(WARSAW, edge, object).altitudeDeg;
          expect(
            Math.abs(altitude - minAltitudeDeg),
            `minimum ${minAltitudeDeg}°: ${object.id} at ${edge.toISOString()}`,
          ).toBeLessThan(0.05);
        }
      });
      // A property over no edges passes for the wrong reason.
      expect(edges, `minimum ${minAltitudeDeg}°: refined edges checked`).toBeGreaterThan(40);
    }
    expect(minimums).toHaveLength(3);
  });
});
