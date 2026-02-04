"use client";

import { useCallback, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Academy } from "@/types";

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%", borderRadius: "12px" };

export type AcademyWithCoords = {
  academy: Academy;
  coords: { lat: number; lng: number };
};

interface AcademyMapBlockProps {
  center: { lat: number; lng: number };
  zoom: number;
  academiesWithCoords: AcademyWithCoords[];
  selectedAcademy: Academy | null;
  onSelectAcademy: (academy: Academy | null) => void;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
  onZoomChange?: (zoom: number) => void;
}

export function AcademyMapBlock({
  center,
  zoom,
  academiesWithCoords,
  selectedAcademy,
  onSelectAcademy,
  onCenterChange,
  onZoomChange,
}: AcademyMapBlockProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded } = useJsApiLoader({
    id: "google-map-academy",
    googleMapsApiKey: apiKey,
  });

  const mapCenter = useMemo(
    () => (center?.lat != null && center?.lng != null ? center : DEFAULT_CENTER),
    [center?.lat, center?.lng]
  );

  const onLoad = useCallback(() => {}, []);
  const onUnmount = useCallback(() => {}, []);

  const onMarkerClick = useCallback(
    (academy: Academy) => {
      onSelectAcademy(academy);
    },
    [onSelectAcademy]
  );

  const onMapClick = useCallback(() => {
    onSelectAcademy(null);
  }, [onSelectAcademy]);

  const onBoundsChanged = useCallback(() => {
    // Optional: read map center/zoom from ref if needed
  }, []);

  if (!isLoaded) {
    return (
      <div
        className="w-full h-full bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-xl"
        style={MAP_CONTAINER_STYLE}
      />
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={mapCenter}
      zoom={zoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={onMapClick}
      onBoundsChanged={onBoundsChanged}
      options={{
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      }}
    >
      {academiesWithCoords.map(({ academy, coords }) => (
        <Marker
          key={academy.id}
          position={coords}
          onClick={() => onMarkerClick(academy)}
          icon={
            selectedAcademy?.id === academy.id
              ? undefined
              : undefined
          }
          zIndex={selectedAcademy?.id === academy.id ? 2 : 1}
        />
      ))}
    </GoogleMap>
  );
}
