# Calibration harness: moonlight model (moonlight-and-the-verdict)

The throwaway vitest harness used during planning (2026-10-02) to calibrate the Phase 1 candidates. It runs the **real engine** (darkWindow, objectTracks, moonTrack, moonSeparationDeg, scoreObject) and applies the planned model on top, so you can see the before/after effect before any engine code changes. Results are in `plan.md` → Current State Analysis → Calibration.

## How to run (outside the repo — never commit it as a test)

1. Make a scratch directory, e.g. `<scratch>/h/`, and put two files there:
   - `vitest.config.mjs` (below), with `root` set to that directory;
   - `model2.spec.ts`: the code block below.
2. Then run, from the repo root:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null
MREF=1.5 CFG="3.5:1.5" npx vitest run --config <scratch>/h/vitest.config.mjs --silent=false --reporter=verbose 2>&1 | grep -E "^20|^  (BASE|T)"
```

The environment variables:

- `CFG` is a comma-separated list of `T:offset` pairs (washed-out contrast threshold : bright-core offset).
- `MREF` is the moonlight reference in magnitudes.

The output shows, per night and Bortle class, the baseline cleared count and top 5, then for each configuration the cleared count (with the diffuse count), the washed-out list and the new top 5.

```js
// vitest.config.mjs
export default {
  root: "<scratch>/h",
  resolve: { alias: { "@": "/Users/rafalskwara/projects/sidereus/src", "astronomy-engine": "/Users/rafalskwara/projects/sidereus/node_modules/astronomy-engine/esm/astronomy.js" } },
  server: { fs: { allow: ["/"] } },
  test: { include: ["*.spec.ts"], environment: "node" },
};
```

```ts
import { it } from "vitest";
import { MESSIER } from "@/lib/catalogue";
import { darkWindow, observingNight, darknessThresholdDegForBortle, objectTracks, moonTrack, bestWindow, moonSeparationDeg, scoreObject, DEFAULT_TRACK_STEP_MINUTES, MIN_OBJECT_SCORE, SCORE_WEIGHTS } from "@/lib/engine";
const DIFFUSE = ["galaxy","nebula","emission-nebula","reflection-nebula","planetary-nebula","supernova-remnant","cluster-with-nebula"];
const SENS: Record<string, number> = { galaxy:1, nebula:1, "emission-nebula":1, "reflection-nebula":1, "planetary-nebula":1, "supernova-remnant":1, "cluster-with-nebula":0.6, "globular-cluster":0.6, "open-cluster":0.3, asterism:0.3, "double-star":0.15, other:0.3 };
const ZENB = [21.9,21.7,21.4,20.8,20.1,19.3,18.7,18.2,17.8];
const k = 0.25, MREF = Number(process.env.MREF ?? 3);
const X = (zDeg:number)=>1/Math.sqrt(1-0.96*Math.sin(zDeg*Math.PI/180)**2);
const toNL = (V:number)=>34.08*Math.exp(20.7233-0.92104*V);
const toMag = (B:number)=>(20.7233-Math.log(B/34.08))/0.92104;
function skyNL(zen:number, alpha:number, mAlt:number, oAlt:number, rho:number){
  const Z = 90-oAlt; const B0 = toNL(zen)*Math.pow(10,-0.4*k*(X(Z)-1))*X(Z); let Bm=0;
  if (mAlt>0 && oAlt>0){ const Zm=90-mAlt; const I=Math.pow(10,-0.4*(3.84+0.026*Math.abs(alpha)+4e-9*alpha**4))*(Math.abs(alpha)<7?1.35:1);
    const r=rho*Math.PI/180; const f = rho<10 ? 6.2e7/rho**2 : Math.pow(10,5.36)*(1.06+Math.cos(r)**2)+Math.pow(10,6.15-rho/40);
    Bm = f*I*Math.pow(10,-0.4*k*X(Zm))*(1-Math.pow(10,-0.4*k*X(Z))); }
  return {B0,Bm};
}
const configs = (process.env.CFG ?? "3.5:2,3.5:1,3.0:1,3.0:0,4.0:2").split(",").map(s=>s.split(":").map(Number));
const nights = [["2026-10-10",6],["2026-10-20",6],["2026-10-24",6],["2026-10-26",6],["2026-10-26",3],["2026-10-10",3]] as const;
for (const [date, bortle] of nights) it(`${date} B${bortle}`, ()=>{
  const site = { latitudeDeg:52.23, longitudeDeg:21.01, elevationM:0, timeZone:"Europe/Warsaw" } as any;
  const w = darkWindow(site, observingNight(date,"Europe/Warsaw"), darknessThresholdDegForBortle(bortle)) as any;
  const iv={start:w.start,end:w.end}; const zen = ZENB[bortle-1];
  const tr = objectTracks(site, iv, MESSIER, DEFAULT_TRACK_STEP_MINUTES); const mt = moonTrack(site, iv, DEFAULT_TRACK_STEP_MINUTES);
  const lines:string[] = [`${date} B${bortle} moon@start ${(mt[0].illuminatedFraction*100).toFixed(0)}%`];
  // baseline
  const base:[string,number][]=[]; const scs = MESSIER.map((o,i)=>scoreObject({object:o,track:tr[i],moonTrack:mt,minAltitudeDeg:15,bortle,apertureMm:150}));
  scs.forEach((s,i)=>{ if(s && s.total>=MIN_OBJECT_SCORE) base.push([MESSIER[i].id,s.total]); }); base.sort((a,b)=>b[1]-a[1]);
  const bgal = base.filter(r=>DIFFUSE.includes(MESSIER.find(o=>o.id===r[0])!.type)).length;
  lines.push(`  BASE cleared ${base.length} (diffuse ${bgal}) top5 ${base.slice(0,5).map(b=>b[0]).join(",")}`);
  for (const [T,OFF] of configs){
    const res:[string,number][]=[]; const washed:string[]=[];
    MESSIER.forEach((o,i)=>{ const s=scs[i]; if(!s) return;
      let sum=0,n=0,allLost=true,anyMoonFault=false;
      const diffuse = DIFFUSE.includes(o.type) && o.majorAxisArcmin!=null;
      const b = o.minorAxisArcmin ?? o.majorAxisArcmin ?? 0;
      const sb = diffuse ? o.vMag + 2.5*Math.log10(Math.PI/4*o.majorAxisArcmin!*b*3600) - OFF : 0;
      for(let j=0;j<tr[i].length;j++){ const p=tr[i][j]; if(p.time<s.window.start||p.time>s.window.end) continue; n++;
        const rho = moonSeparationDeg(p.time,{raHours:o.raHours,decDeg:o.decDeg});
        const {B0,Bm} = skyNL(zen, mt[j].phaseAngleDeg, mt[j].altitudeDeg, p.altitudeDeg, rho);
        const mb = 2.5*Math.log10((B0+Bm)/B0);
        sum += Math.min(1,Math.max(0,1 - (SENS[o.type]??0.3)*mb/MREF));
        if (diffuse){ const dW = sb - toMag(B0+Bm), dWo = sb - toMag(B0); if(!(dW>T)) allLost=false; if(dWo<=T && dW>T) anyMoonFault=true; }
      }
      const moon = sum/n; const tot = s.total + SCORE_WEIGHTS.moon*(moon - s.components.moon);
      const clearsIfDark = s.total + SCORE_WEIGHTS.moon*(1 - s.components.moon) >= MIN_OBJECT_SCORE; // review F2: only the Moon's fault
      const isWashed = diffuse && o.id !== "M16" && allLost && anyMoonFault && clearsIfDark;
      if (isWashed) washed.push(o.id); else if (tot>=MIN_OBJECT_SCORE) res.push([o.id,tot]);
    });
    res.sort((a,b)=>b[1]-a[1]);
    const gal = res.filter(r=>DIFFUSE.includes(MESSIER.find(o=>o.id===r[0])!.type)).length;
    lines.push(`  T${T} off${OFF} M${MREF}: cleared ${res.length} (diffuse ${gal}) washed ${washed.length} [${washed.join(" ")}] top5 ${res.slice(0,5).map(r=>r[0]).join(",")}`);
  }
  console.log(lines.join("\n"));
});
```
