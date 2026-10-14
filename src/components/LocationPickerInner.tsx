"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";

export type LatLng = { lat: number; lng: number };

const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

// Akurdi, near PCCOE: where the map opens before a pin is placed
const DEFAULT_CENTER: [number, number] = [18.6517, 73.7616];

const round7 = (n: number) => Math.round(n * 1e7) / 1e7;

function ClickToPlace({ onChange }: { onChange: (v: LatLng) => void }) {
    useMapEvents({
        click(e) {
            onChange({ lat: round7(e.latlng.lat), lng: round7(e.latlng.lng) });
        },
    });
    return null;
}

// Flies to the current pin whenever the parent bumps `signal` (address search found a place)
function FlyOnSignal({ signal, value }: { signal?: number; value: LatLng | null }) {
    const map = useMap();
    const last = useRef(0);
    useEffect(() => {
        if (signal && signal !== last.current && value) {
            last.current = signal;
            map.flyTo([value.lat, value.lng], 17);
        }
    }, [signal, value, map]);
    return null;
}

function FlyTo({ target }: { target: LatLng | null }) {
    const map = useMap();
    useEffect(() => {
        if (target) map.flyTo([target.lat, target.lng], 17);
    }, [target, map]);
    return null;
}

export default function LocationPickerInner({
    value,
    onChange,
    flySignal,
    height = 320,
}: {
    value: LatLng | null;
    onChange: (v: LatLng) => void;
    flySignal?: number;
    height?: number;
}) {
    const markerRef = useRef<L.Marker>(null);
    const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
    const [geoError, setGeoError] = useState("");

    const dragHandlers = useMemo(
        () => ({
            dragend() {
                const m = markerRef.current;
                if (m) {
                    const p = m.getLatLng();
                    onChange({ lat: round7(p.lat), lng: round7(p.lng) });
                }
            },
        }),
        [onChange]
    );

    const useMyLocation = () => {
        setGeoError("");
        if (!navigator.geolocation) {
            setGeoError("Your browser does not support location.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const v = { lat: round7(pos.coords.latitude), lng: round7(pos.coords.longitude) };
                onChange(v);
                setFlyTarget(v);
            },
            () => setGeoError("Could not get your location. Click on the map instead."),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-on-surface-variant">
                    The pin is placed from your address. Click the map or drag the pin to the exact building.
                </p>
                <button
                    type="button"
                    onClick={useMyLocation}
                    className="text-xs font-bold text-deep-green border border-deep-green rounded-lg px-3 py-1.5 hover:bg-light-sage/20 transition-colors cursor-pointer"
                >
                    Use my current location
                </button>
            </div>

            <MapContainer
                center={value ? [value.lat, value.lng] : DEFAULT_CENTER}
                zoom={value ? 17 : 14}
                scrollWheelZoom={false}
                style={{ height, width: "100%", borderRadius: 12 }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickToPlace onChange={onChange} />
                <FlyTo target={flyTarget} />
                <FlyOnSignal signal={flySignal} value={value} />
                {value && (
                    <Marker
                        position={[value.lat, value.lng]}
                        icon={icon}
                        draggable
                        ref={markerRef}
                        eventHandlers={dragHandlers}
                    />
                )}
            </MapContainer>

            {geoError && <p className="text-xs text-rose-600">{geoError}</p>}
            <p className="text-xs text-on-surface-variant">
                {value
                    ? `Selected: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
                    : "No location selected yet."}
            </p>

            <input type="hidden" name="latitude" value={value ? value.lat.toFixed(7) : ""} />
            <input type="hidden" name="longitude" value={value ? value.lng.toFixed(7) : ""} />
        </div>
    );
}