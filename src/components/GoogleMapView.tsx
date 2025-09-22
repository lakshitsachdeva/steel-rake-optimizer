"use client";
import { GoogleMap, useJsApiLoader, Marker, Polyline } from "@react-google-maps/api";
import { useMemo } from "react";
import type { DataBundle } from "@/lib/mockData";

export type RouteItem = { from: [number, number]; to: [number, number]; color?: string };

export function GoogleMapView({ data, routes }: { data: DataBundle; routes: RouteItem[] }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useJsApiLoader({ id: "gmap-script", googleMapsApiKey: apiKey || "" });

  const center = useMemo(() => {
    const all = [...data.yards, ...data.customers];
    const lat = all.reduce((s, n) => s + n.lat, 0) / Math.max(1, all.length);
    const lng = all.reduce((s, n) => s + n.lng, 0) / Math.max(1, all.length);
    return { lat: isFinite(lat) ? lat : 22.5, lng: isFinite(lng) ? lng : 79.0 };
  }, [data]);

  if (!apiKey) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google Maps</div>;
  if (!isLoaded) return <div className="flex h-full items-center justify-center">Loading map…</div>;

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={center}
      zoom={5}
      options={{ disableDefaultUI: false, mapTypeControl: false, streetViewControl: false }}
    >
      {data.yards.map((y) => (
        <Marker key={y.id} position={{ lat: y.lat, lng: y.lng }} label={{ text: y.id, color: "#0f172a" }} />
      ))}
      {data.customers.map((c) => (
        <Marker key={c.id} position={{ lat: c.lat, lng: c.lng }} label={{ text: c.id, color: "#059669" }} />
      ))}
      {routes.map((r, idx) => (
        <Polyline
          key={idx}
          path={[
            { lat: r.from[0], lng: r.from[1] },
            { lat: r.to[0], lng: r.to[1] },
          ]}
          options={{ strokeColor: r.color || "#2563eb", strokeWeight: 3, strokeOpacity: 0.9 }}
        />
      ))}
    </GoogleMap>
  );
}

export default GoogleMapView;