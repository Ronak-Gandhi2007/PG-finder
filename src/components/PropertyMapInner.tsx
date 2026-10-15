"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

export type Pt = {
    id: string;
    lat: number;
    lng: number;
    name?: string;
    href?: string;
};

export default function PropertyMapInner({
    points,
    height = 320,
}: {
    points: Pt[];
    height?: number;
}) {
    if (!points.length) return null;

    const bounds = L.latLngBounds(
        points.map((p) => [p.lat, p.lng] as [number, number])
    );

    return (
        <MapContainer
            {...(points.length > 1
                ? { bounds, boundsOptions: { padding: [30, 30] as [number, number] } }
                : { center: [points[0].lat, points[0].lng] as [number, number], zoom: 16 })}
            scrollWheelZoom={false}
            style={{ height, width: "100%", borderRadius: 12 }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((p) => (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={icon}>
                    <Popup>
                        {p.href ? <a href={p.href}>{p.name}</a> : p.name}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}