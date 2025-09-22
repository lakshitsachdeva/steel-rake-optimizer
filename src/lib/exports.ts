/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import type { OptimizationResult, Assignment, OptimizationParams } from "./optimizer";
import type { DataBundle } from "./mockData";
import * as XLSX from "xlsx";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportPlanToCSV(result: OptimizationResult, data: DataBundle) {
  const rows: Array<Record<string, any>> = [];
  const orderById = new Map(data.orders.map((o) => [o.id, o] as const));
  for (const a of result.assignments) {
    const o = orderById.get(a.orderId)!;
    rows.push({
      orderId: a.orderId,
      customerId: o.customerId,
      product: o.product,
      priority: o.priority ?? 1,
      dueHour: o.dueHour,
      yardId: a.yardId,
      rakeId: a.rakeId,
      tons: Math.round(a.tons),
      distanceKm: Math.round(a.distanceKm),
      etaHour: +a.etaHour.toFixed(2),
      cost: Math.round(a.cost),
    });
  }
  const header = Object.keys(rows[0] ?? {
    orderId: "",
    customerId: "",
    product: "",
    priority: 1,
    dueHour: 0,
    yardId: "",
    rakeId: "",
    tons: 0,
    distanceKm: 0,
    etaHour: 0,
    cost: 0,
  });
  const csv = [header.join(","), ...rows.map((r) => header.map((h) => r[h]).join(","))].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "dispatch_plan.csv");
}

export function exportPlanToXLSX(
  result: OptimizationResult,
  data: DataBundle,
  params?: OptimizationParams
) {
  const wb = XLSX.utils.book_new();

  // Assignments sheet
  const orderById = new Map(data.orders.map((o) => [o.id, o] as const));
  const rows: Array<Record<string, any>> = result.assignments.map((a) => {
    const o = orderById.get(a.orderId)!;
    return {
      orderId: a.orderId,
      customerId: o.customerId,
      product: o.product,
      priority: o.priority ?? 1,
      dueHour: o.dueHour,
      yardId: a.yardId,
      rakeId: a.rakeId,
      tons: Math.round(a.tons),
      distanceKm: Math.round(a.distanceKm),
      etaHour: +a.etaHour.toFixed(2),
      cost: Math.round(a.cost),
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws1, "Plan");

  // KPIs sheet
  const kpi = result.metrics;
  const ws2 = XLSX.utils.aoa_to_sheet([
    ["Metric", "Value"],
    ["Total Tons", Math.round(kpi.totalTons)],
    ["Total Cost", Math.round(kpi.totalCost)],
    ["Avg ETA (h)", +kpi.avgETA.toFixed(2)],
    ["On-time %", +kpi.onTimePct.toFixed(2)],
    ["Rake Utilization %", +kpi.rakeUtilizationPct.toFixed(2)],
  ]);
  XLSX.utils.book_append_sheet(wb, ws2, "KPIs");

  // Params sheet (optional)
  if (params) {
    const ws3 = XLSX.utils.aoa_to_sheet([
      ["Param", "Value"],
      ["costPerKmPerTon", params.costPerKmPerTon],
      ["tardinessPenaltyPerTonPerHour", params.tardinessPenaltyPerTonPerHour],
      ["loadingPenaltyPerHour", params.loadingPenaltyPerHour],
      ["serviceLevelWeight", params.serviceLevelWeight],
      ["maxWorkHours", params.maxWorkHours],
    ]);
    XLSX.utils.book_append_sheet(wb, ws3, "Params");
  }

  const blob = new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, "dispatch_plan.xlsx");
}