"use client";
import dynamic from "next/dynamic";

const PropertyMap = dynamic(() => import("./PropertyMapInner"), {
    ssr: false,
    loading: () => <div className="h-80 animate-pulse rounded-xl bg-gray-200" />,
});

export default PropertyMap;