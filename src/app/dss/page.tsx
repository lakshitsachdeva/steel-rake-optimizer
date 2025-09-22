"use client";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateSyntheticData, DataBundle } from "@/lib/mockData";
import { optimizeRakes, OptimizationParams } from "@/lib/optimizer";
import { exportPlanToCSV, exportPlanToXLSX } from "@/lib/exports";

export default function DSSPage() {
  const [seedKey, setSeedKey] = useState(1);
  const [params, setParams] = useState<OptimizationParams>({
    costPerKmPerTon: 1.8,
    tardinessPenaltyPerTonPerHour: 15,
    loadingPenaltyPerHour: 2000,
    serviceLevelWeight: 0.4,
    maxWorkHours: 72,
  });
  const [enableMapAnim, setEnableMapAnim] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  const data = useMemo<DataBundle>(() => generateSyntheticData({}), [seedKey]);
  const [result, setResult] = useState(() => optimizeRakes(data, params));
  useEffect(() => {
    setResult(optimizeRakes(data, params));
  }, [data, params]);

  const runOptimize = async () => {
    setIsRunning(true);
    try {
      // Use reliable heuristic only (MILP & Google Maps removed)
      setResult(optimizeRakes(data, params));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 bg-gradient-to-b from-white to-white/60 dark:from-[#0b0f1a] dark:to-[#0b0f1a]/60">
      <div className="space-y-4 lg:col-span-1">
        <Card className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle>Rake Optimization DSS</CardTitle>
            <CardDescription>Control panel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Service Weight</Label>
                <div className="mt-2"><Slider value={[Math.round(params.serviceLevelWeight * 100)]} onValueChange={(v) => setParams(p => ({ ...p, serviceLevelWeight: v[0] / 100 }))} /></div>
              </div>
              <div>
                <Label>Cost/km/ton</Label>
                <Input type="number" value={params.costPerKmPerTon} onChange={(e) => setParams(p => ({ ...p, costPerKmPerTon: Number(e.target.value) }))} className="mt-1"/>
              </div>
              <div>
                <Label>Tardiness Penalty</Label>
                <Input type="number" value={params.tardinessPenaltyPerTonPerHour} onChange={(e) => setParams(p => ({ ...p, tardinessPenaltyPerTonPerHour: Number(e.target.value) }))} className="mt-1"/>
              </div>
              <div>
                <Label>Horizon (hours)</Label>
                <Input type="number" value={params.maxWorkHours} onChange={(e) => setParams(p => ({ ...p, maxWorkHours: Number(e.target.value) }))} className="mt-1"/>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <Switch checked={enableMapAnim} onCheckedChange={setEnableMapAnim} id="anim" />
                <Label htmlFor="anim">Animate routes (N/A)</Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setSeedKey((k) => k + 1)} variant="secondary">Regenerate Data</Button>
              <Button onClick={runOptimize} disabled={isRunning}>{isRunning ? "Optimizing…" : "Run Optimize"}</Button>
              <Button variant="outline" onClick={() => exportPlanToCSV(result, data)}>Export CSV</Button>
              <Button variant="outline" onClick={() => exportPlanToXLSX(result, data, params)}>Export XLSX</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <Tabs defaultValue="plan">
          <TabsList>
            <TabsTrigger value="plan">Dispatch Plan</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>
          <TabsContent value="plan">
            <Card className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle>Dispatch Plan</CardTitle>
                <CardDescription>Rake assignments</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>From Yard</TableHead>
                      <TableHead>Rake</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Tons</TableHead>
                      <TableHead className="text-right">Distance (km)</TableHead>
                      <TableHead className="text-right">ETA (h)</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.assignments.slice(0, 200).map((a) => {
                      const order = data.orders.find((o) => o.id === a.orderId);
                      if (!order) return null;
                      return (
                        <TableRow key={`${a.orderId}-${a.rakeId}`}>
                          <TableCell>{a.orderId}</TableCell>
                          <TableCell>{a.yardId}</TableCell>
                          <TableCell>{a.rakeId}</TableCell>
                          <TableCell>{order.product}</TableCell>
                          <TableCell className="text-right">{a.tons.toFixed(0)}</TableCell>
                          <TableCell className="text-right">{a.distanceKm.toFixed(0)}</TableCell>
                          <TableCell className="text-right">{a.etaHour.toFixed(1)}</TableCell>
                          <TableCell className="text-right">₹ {a.cost.toFixed(0)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="metrics">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-white/20 shadow-lg">
                <CardHeader>
                  <CardTitle>Total Tonnage</CardTitle>
                  <CardDescription>Optimized</CardDescription>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">{result.metrics.totalTons.toFixed(0)} t</CardContent>
              </Card>
              <Card className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-white/20 shadow-lg">
                <CardHeader>
                  <CardTitle>Total Cost</CardTitle>
                  <CardDescription>Transport + penalties</CardDescription>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">₹ {result.metrics.totalCost.toFixed(0)}</CardContent>
              </Card>
              <Card className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-white/20 shadow-lg">
                <CardHeader>
                  <CardTitle>On-time Service</CardTitle>
                  <CardDescription>% tons on-time</CardDescription>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">{result.metrics.onTimePct.toFixed(1)}%</CardContent>
              </Card>
              <Card className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-white/20 shadow-lg">
                <CardHeader>
                  <CardTitle>Avg ETA</CardTitle>
                  <CardDescription>Hours</CardDescription>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">{result.metrics.avgETA.toFixed(1)} h</CardContent>
              </Card>
              <Card className="bg-white/70 dark:bg-white/5 backdrop-blur-md border border-white/20 shadow-lg">
                <CardHeader>
                  <CardTitle>Rake Utilization</CardTitle>
                  <CardDescription>Capacity used</CardDescription>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">{result.metrics.rakeUtilizationPct.toFixed(1)}%</CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}