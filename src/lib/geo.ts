// Default college for distance calculation
export const COLLEGE = { name: 'PCCOE Akurdi', lat: 18.652239, lng: 73.764316 };

type Point = { lat: number; lng: number };

// Straight-line distance between two points, in km
export function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Turns a straight-line distance into the km number + the text students see
export function describeDistance(straightKm: number): { km: number; text: string } {
  const km = Math.round(straightKm * 10) / 10;
  const roadKm = straightKm * 1.3; // roads are longer than a straight line
  if (roadKm <= 2) {
    const mins = Math.max(1, Math.round(roadKm * 12)); // walking ~5 km/h
    return { km, text: `${mins} mins walk to ${COLLEGE.name}` };
  }
  const mins = Math.max(1, Math.round(roadKm * 3)); // bike/auto ~20 km/h
  return { km, text: `${mins} mins by bike/auto to ${COLLEGE.name}` };
}