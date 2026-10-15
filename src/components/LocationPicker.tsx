"use client";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(
    () => import("./LocationPickerInner").then((mod) => mod.default),
    {
        ssr: false,
        loading: () => <div className="h-80 animate-pulse rounded-xl bg-gray-200" />,
    }
);

export default LocationPicker;