export type Yard = { id: string; name: string; lat: number; lng: number; inventory: Record<string, number>; loadingRateTph: number };
export type Customer = { id: string; name: string; lat: number; lng: number; demand: Record<string, number>; dueHour: number };
export type Order = { id: string; customerId: string; product: string; tons: number; dueHour: number; priority?: number };
export type Rake = { id: string; wagons: number; capacityPerWagonTons: number; maxSpeedKmph: number; fixedCost: number; crewWindowHours?: number; maintenanceDowntimeHours?: number };
export type Edge = { from: string; to: string; distanceKm: number };
export type Node = { id: string; lat: number; lng: number; kind: "yard" | "customer" | "junction" };

export type Network = { nodes: Node[]; edges: Edge[] };

export type DataBundle = {
  yards: Yard[];
  customers: Customer[];
  orders: Order[];
  rakes: Rake[];
  products: string[];
  network: Network;
};

const rnd = (min: number, max: number) => Math.random() * (max - min) + min;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function generateSyntheticData(params?: {
  yardsCount?: number;
  customersCount?: number;
  products?: string[];
  rakesCount?: number;
  seed?: number;
}): DataBundle {
  const products = params?.products ?? ["Lump Ore", "Fines", "Pellets", "Coal"];

  // India metro anchors roughly
  const anchors = [
    { name: "Bhilai", lat: 21.1938, lng: 81.3509 },
    { name: "Bokaro", lat: 23.6693, lng: 86.1511 },
    { name: "Rourkela", lat: 22.2604, lng: 84.8536 },
    { name: "Durgapur", lat: 23.5204, lng: 87.3119 },
    { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
  ];

  const yards: Yard[] = anchors.slice(0, params?.yardsCount ?? 4).map((a, i) => ({
    id: `Y${i + 1}`,
    name: `${a.name} Stockyard`,
    lat: a.lat + rnd(-0.2, 0.2),
    lng: a.lng + rnd(-0.2, 0.2),
    inventory: Object.fromEntries(products.map(p => [p, Math.floor(rnd(40_000, 120_000))])),
    loadingRateTph: Math.floor(rnd(1500, 3500)),
  }));

  const customers: Customer[] = Array.from({ length: params?.customersCount ?? 10 }).map((_, i) => {
    const anchor = pick(anchors);
    return {
      id: `C${i + 1}`,
      name: `Customer ${i + 1}`,
      lat: anchor.lat + rnd(-4, 4),
      lng: anchor.lng + rnd(-4, 4),
      demand: Object.fromEntries(products.map(p => [p, Math.floor(rnd(5_000, 30_000))])),
      dueHour: Math.floor(rnd(12, 96)),
    };
  });

  const orders: Order[] = customers.flatMap((c) => {
    const product = pick(products);
    const tons = Math.min(c.demand[product], Math.floor(rnd(2_500, 20_000)));
    const priority = [1, 2, 3][Math.floor(rnd(0, 3))];
    return [{ id: `O-${c.id}-${product}`, customerId: c.id, product, tons, dueHour: c.dueHour, priority }];
  });

  const rakes: Rake[] = Array.from({ length: params?.rakesCount ?? 12 }).map((_, i) => ({
    id: `R${i + 1}`,
    wagons: 58,
    capacityPerWagonTons: Math.floor(rnd(55, 65)),
    maxSpeedKmph: Math.floor(rnd(45, 70)),
    fixedCost: Math.floor(rnd(2_00_000, 4_50_000)),
    crewWindowHours: Math.floor(rnd(36, 96)),
    maintenanceDowntimeHours: Math.floor(rnd(0, 8)),
  }));

  // Build a sparse network graph by connecting each yard to near customers and between yards
  const nodes: Node[] = [
    ...yards.map((y) => ({ id: y.id, lat: y.lat, lng: y.lng, kind: "yard" as const })),
    ...customers.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, kind: "customer" as const })),
  ];

  const edges: Edge[] = [];
  for (const y of yards) {
    // connect to 5 closest customers
    const closest = [...customers]
      .map((c) => ({ c, d: haversine(y.lat, y.lng, c.lat, c.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
    closest.forEach(({ c, d }) => edges.push({ from: y.id, to: c.id, distanceKm: Math.max(50, Math.round(d)) }));
  }
  // connect yards between themselves
  for (let i = 0; i < yards.length; i++)
    for (let j = i + 1; j < yards.length; j++) {
      const d = haversine(yards[i].lat, yards[i].lng, yards[j].lat, yards[j].lng);
      edges.push({ from: yards[i].id, to: yards[j].id, distanceKm: Math.max(50, Math.round(d)) });
    }

  return {
    yards,
    customers,
    orders,
    rakes,
    products,
    network: { nodes, edges },
  };
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}