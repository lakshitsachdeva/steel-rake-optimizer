"use client";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import { DataBundle } from "@/lib/mockData";

// Fix default icon paths in Leaflet when using bundlers
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type RouteLine = { from: [number, number]; to: [number, number]; color?: string };

export default function MapView({ data, routes }: { data: DataBundle; routes: RouteLine[] }) {
  const center: [number, number] = [21.5, 82.0];
  return (
    <div className="w-full h-full">
      <MapContainer center={center} zoom={5} className="w-full h-full rounded-lg overflow-hidden">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {data.yards.map((y) => (
          <Marker key={y.id} position={[y.lat, y.lng]}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{y.name}</div>
                <div>Loading: {y.loadingRateTph} tph</div>
              </div>
            </Popup>
          </Marker>
        ))}
        {data.customers.map((c) => (
          <Marker key={c.id} position={[c.lat, c.lng]}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{c.name}</div>
                <div>Due: {c.dueHour} h</div>
              </div>
            </Popup>
          </Marker>
        ))}
        {routes.map((r, i) => (
          <Polyline key={i} positions={[r.from, r.to]} color={r.color ?? "#2563eb"} />
        ))}
      </MapContainer>
    </div>
  );
}