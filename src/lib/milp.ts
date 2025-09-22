/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import type { DataBundle, Order, Yard, Rake } from "./mockData";
import type { OptimizationResult, OptimizationParams } from "./optimizer";
import GLPKFactory from "glpk.js";

// Precompute candidate coefficients for linear model
function buildCandidates(data: DataBundle, params: OptimizationParams) {
  const candidates: Array<{
    key: string;
    order: Order;
    yard: Yard;
    rake: Rake;
    distanceKm: number;
    travelHours: number;
    perTonCost: number; // transport + tardiness weighted by priority
    hourPerTon: number; // linearized time usage per ton for this rake-route
  }> = [];

  const custMap = new Map(data.customers.map((c) => [c.id, c] as const));

  for (const o of data.orders) {
    const cust = custMap.get(o.customerId)!;
    for (const y of data.yards) {
      const distanceKm = Math.max(
        1,
        Math.round(
          // simple haversine; recreate lightweight to avoid circular import
          (() => {
            const R = 6371;
            const toRad = (x: number) => (x * Math.PI) / 180;
            const dLat = toRad(cust.lat - y.lat);
            const dLon = toRad(cust.lng - y.lng);
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(y.lat)) * Math.cos(toRad(cust.lat)) * Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
          })()
        )
      );
      for (const r of data.rakes) {
        const speed = Math.max(30, r.maxSpeedKmph);
        const travelHours = distanceKm / speed;
        const rakeCap = r.wagons * r.capacityPerWagonTons;
        const loadHoursPerTon = 1 / Math.max(1, y.loadingRateTph);
        // Linearized hour per ton assumes one full trip shares travel over capacity
        const hourPerTon = loadHoursPerTon + travelHours / Math.max(1, rakeCap);
        const arrivalHoursApprox = travelHours; // ignoring queueing; load cost handled separately
        const tardinessH = Math.max(0, arrivalHoursApprox - o.dueHour);
        const priorityWeight = o.priority ?? 1; // 1..3
        const perTonTransport = params.costPerKmPerTon * distanceKm;
        const perTonPenalty = params.tardinessPenaltyPerTonPerHour * tardinessH * priorityWeight;
        const perTonCost =
          (1 - params.serviceLevelWeight) * perTonTransport +
          params.serviceLevelWeight * perTonPenalty;

        candidates.push({
          key: `${o.id}_${y.id}_${r.id}`,
          order: o,
          yard: y,
          rake: r,
          distanceKm,
          travelHours,
          perTonCost,
          hourPerTon,
        });
      }
    }
  }

  return candidates;
}

export async function optimizeRakesMILP(
  data: DataBundle,
  params: OptimizationParams
): Promise<OptimizationResult> {
  const GLPK = await GLPKFactory();

  const cands = buildCandidates(data, params);

  // Map variable indices
  const varIndex = new Map<string, number>();
  cands.forEach((c, i) => varIndex.set(c.key, i + 1)); // 1-based

  // Variables: x[key] >= 0 (tons shipped for that (order,yard,rake))
  const ia: number[] = []; // row indices
  const ja: number[] = []; // col indices
  const ar: number[] = []; // values

  const rows: Array<{ name: string; lb: number; ub: number }> = [];
  const cols: Array<{ name: string; lb: number; ub: number; obj: number }> = [];

  // Define columns
  for (const cand of cands) {
    cols.push({ name: cand.key, lb: 0, ub: 1e9, obj: cand.perTonCost });
  }

  // 1) Order demand satisfaction: sum_y,r x[o,y,r] == demand_o
  for (const o of data.orders) {
    const rowIndex = rows.length + 1;
    rows.push({ name: `demand_${o.id}`, lb: o.tons, ub: o.tons });
    cands
      .filter((c) => c.order.id === o.id)
      .forEach((c) => {
        const col = varIndex.get(c.key)!;
        ia.push(rowIndex);
        ja.push(col);
        ar.push(1);
      });
  }

  // 2) Yard inventory by product: sum_o,r x[o,y,r | product(o)] <= inv[y,product]
  for (const y of data.yards) {
    for (const product of data.products) {
      const inv = y.inventory[product] ?? 0;
      const rowIndex = rows.length + 1;
      rows.push({ name: `inv_${y.id}_${product}`, lb: 0, ub: inv });
      cands
        .filter((c) => c.yard.id === y.id && c.order.product === product)
        .forEach((c) => {
          const col = varIndex.get(c.key)!;
          ia.push(rowIndex);
          ja.push(col);
          ar.push(1);
        });
    }
  }

  // 3) Rake available hours window (fleet scheduling approx):
  // sum_{o,y} x[o,y,r] * hourPerTon_{o,y,r} <= availableHours_r
  for (const r of data.rakes) {
    const available = Math.max(
      0,
      (r.crewWindowHours ?? params.maxWorkHours) - (r.maintenanceDowntimeHours ?? 0)
    );
    const rowIndex = rows.length + 1;
    rows.push({ name: `hrs_${r.id}`, lb: 0, ub: available });
    cands
      .filter((c) => c.rake.id === r.id)
      .forEach((c) => {
        const col = varIndex.get(c.key)!;
        ia.push(rowIndex);
        ja.push(col);
        ar.push(c.hourPerTon);
      });
  }

  // 4) Yard loading capacity over horizon: sum x / loadingRate <= maxWorkHours
  for (const y of data.yards) {
    const rowIndex = rows.length + 1;
    rows.push({ name: `yard_hours_${y.id}`, lb: 0, ub: params.maxWorkHours });
    const loadRate = Math.max(1, y.loadingRateTph);
    cands
      .filter((c) => c.yard.id === y.id)
      .forEach((c) => {
        const col = varIndex.get(c.key)!;
        ia.push(rowIndex);
        ja.push(col);
        ar.push(1 / loadRate);
      });
  }

  // Build problem
  const lp: any = {
    name: "Rake Optimization MILP",
    objective: {
      direction: GLPK.GLP_MIN,
      name: "obj",
      vars: cols.map((c, i) => ({ name: c.name, coef: c.obj })),
    },
    subjectTo: rows.map((r) => ({ name: r.name, bnds: { type: GLPK.GLP_DB, ub: r.ub, lb: r.lb } })),
    bounds: cols.map((c) => ({ name: c.name, type: GLPK.GLP_DB, lb: c.lb, ub: c.ub })),
    binaries: [],
    generals: [],
  };

  // Matrix
  lp.matrix = ia.map((_, k) => ({ row: rows[ia[k] - 1].name, col: cols[ja[k] - 1].name, coef: ar[k] }));

  const { result } = GLPK.solve(lp, { msglev: GLPK.GLP_MSG_OFF });

  // Build assignments from positive variables
  const assignments: OptimizationResult["assignments"] = [];
  const valueByVar = new Map<string, number>();
  for (const v of result.vars as Array<{ name: string; value: number }>) {
    valueByVar.set(v.name, v.value);
  }

  // Aggregate per candidate into assignments lines
  for (const cand of cands) {
    const tons = valueByVar.get(cand.key) ?? 0;
    if (tons <= 1e-3) continue;
    assignments.push({
      orderId: cand.order.id,
      yardId: cand.yard.id,
      rakeId: cand.rake.id,
      tons,
      distanceKm: cand.distanceKm,
      // ETA rough: load time for this tons + travel
      etaHour: tons / Math.max(1, cand.yard.loadingRateTph) + cand.travelHours,
      cost: tons * cand.perTonCost,
    });
  }

  // Compute KPIs similar to heuristic
  let totalTons = 0;
  let totalCost = 0;
  let totalEta = 0;
  let onTimeTons = 0;
  for (const a of assignments) {
    totalTons += a.tons;
    totalCost += a.cost;
    totalEta += a.etaHour * a.tons;
    const order = data.orders.find((o) => o.id === a.orderId)!;
    if (a.etaHour <= order.dueHour) onTimeTons += a.tons;
  }
  const rakeUtilizationPct = data.rakes.length
    ? (assignments.reduce((s, a) => s + a.tons, 0) /
        data.rakes.reduce((s, r) => s + r.wagons * r.capacityPerWagonTons, 0)) *
      100
    : 0;

  const metrics = {
    totalTons,
    totalCost,
    avgETA: totalTons ? totalEta / totalTons : 0,
    onTimePct: totalTons ? (onTimeTons / totalTons) * 100 : 0,
    rakeUtilizationPct,
  };

  // Objective value from solver
  const objective = result.z ?? totalCost;

  return { assignments, objective, metrics, messages: [] };
}