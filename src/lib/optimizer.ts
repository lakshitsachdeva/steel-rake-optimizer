/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataBundle, haversine, Order, Yard, Rake } from "./mockData";

export type OptimizationParams = {
  costPerKmPerTon: number; // transport variable cost
  tardinessPenaltyPerTonPerHour: number; // penalty if arrival after dueHour
  loadingPenaltyPerHour: number; // soft penalty for exceeding yard loading capacity per hour
  serviceLevelWeight: number; // weight between cost and service level (0..1)
  maxWorkHours: number; // planning horizon hours
};

export type Assignment = {
  orderId: string;
  yardId: string;
  rakeId: string;
  tons: number;
  distanceKm: number;
  etaHour: number;
  cost: number;
};

export type OptimizationResult = {
  assignments: Assignment[];
  objective: number;
  metrics: {
    totalTons: number;
    totalCost: number;
    avgETA: number;
    onTimePct: number;
    rakeUtilizationPct: number;
  };
  messages: string[];
};

export function optimizeRakes(data: DataBundle, params: OptimizationParams): OptimizationResult {
  const messages: string[] = [];

  // Greedy heuristic: allocate orders by earliest due date to best yard+rake based on blended per-ton score
  type Cand = { key: string; order: Order; yard: Yard; rake: Rake; distanceKm: number; hours: number; perTonScore: number; maxTons: number };

  // State trackers
  const invUsed: Record<string, Record<string, number>> = {};
  for (const y of data.yards) invUsed[y.id] = {} as Record<string, number>;
  const rakeCapLeft: Record<string, number> = Object.fromEntries(
    data.rakes.map((r) => [r.id, r.wagons * r.capacityPerWagonTons])
  );
  const yardLoadHoursUsed: Record<string, number> = Object.fromEntries(data.yards.map((y) => [y.id, 0]));

  const assignments: Assignment[] = [];

  const ordersSorted = [...data.orders].sort((a, b) => a.dueHour - b.dueHour);

  for (const order of ordersSorted) {
    let remaining = order.tons;

    // Build candidates for this order
    const cust = data.customers.find((c) => c.id === order.customerId)!;
    const cands: Cand[] = [];
    for (const yard of data.yards) {
      const availableInv = (yard.inventory[order.product] ?? 0) - (invUsed[yard.id][order.product] ?? 0);
      if (availableInv <= 0) continue;
      const distanceKm = Math.max(1, Math.round(haversine(yard.lat, yard.lng, cust.lat, cust.lng)));
      for (const rake of data.rakes) {
        const capLeft = rakeCapLeft[rake.id];
        if (capLeft <= 0) continue;
        const travelHours = Math.max(1, distanceKm / Math.max(30, rake.maxSpeedKmph));
        // approximate loading hours if we sent full rake; will adjust after choosing tons
        const hours = travelHours; // loading handled via yardLoadHoursUsed constraint below
        if (hours > params.maxWorkHours) continue;
        const tardinessH = Math.max(0, hours - order.dueHour);
        const priorityWeight = order.priority ?? 1;
        const transportPerTon = params.costPerKmPerTon * distanceKm;
        const penaltyPerTon = params.tardinessPenaltyPerTonPerHour * tardinessH * priorityWeight;
        const perTonScore = (1 - params.serviceLevelWeight) * transportPerTon + params.serviceLevelWeight * penaltyPerTon;
        const maxTons = Math.max(0, Math.min(remaining, availableInv, capLeft));
        if (maxTons > 0) cands.push({ key: `${order.id}_${yard.id}_${rake.id}`, order, yard, rake, distanceKm, hours, perTonScore, maxTons });
      }
    }

    // Pick best candidates iteratively
    cands.sort((a, b) => a.perTonScore - b.perTonScore);
    for (const cand of cands) {
      if (remaining <= 0) break;
      const yardHoursLeft = params.maxWorkHours - yardLoadHoursUsed[cand.yard.id];
      const maxLoadableTonsByHours = Math.max(0, Math.floor(yardHoursLeft * cand.yard.loadingRateTph));
      const alloc = Math.min(remaining, cand.maxTons, maxLoadableTonsByHours);
      if (alloc <= 0) continue;

      // Commit allocation
      invUsed[cand.yard.id][order.product] = (invUsed[cand.yard.id][order.product] ?? 0) + alloc;
      rakeCapLeft[cand.rake.id] -= alloc;
      const loadHours = alloc / Math.max(1, cand.yard.loadingRateTph);
      yardLoadHoursUsed[cand.yard.id] += loadHours;

      const arrival = loadHours + cand.hours;
      const tardinessH = Math.max(0, arrival - order.dueHour);
      const priorityWeight = order.priority ?? 1;
      const cost = alloc * (params.costPerKmPerTon * cand.distanceKm) + alloc * params.tardinessPenaltyPerTonPerHour * tardinessH * priorityWeight;

      assignments.push({
        orderId: order.id,
        yardId: cand.yard.id,
        rakeId: cand.rake.id,
        tons: alloc,
        distanceKm: cand.distanceKm,
        etaHour: arrival,
        cost,
      });

      remaining -= alloc;
    }

    if (remaining > 0) {
      messages.push(`Unfulfilled: ${order.id} short by ${remaining.toFixed(0)} tons`);
    }
  }

  // Aggregate metrics
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

  // Objective proxy: total cost + penalty for unfulfilled demand (soft)
  const unfulfilledPenalty = 2000; // per ton
  const totalDemand = data.orders.reduce((s, o) => s + o.tons, 0);
  const objective = totalCost + unfulfilledPenalty * Math.max(0, totalDemand - totalTons);

  return { assignments, objective, metrics, messages };
}