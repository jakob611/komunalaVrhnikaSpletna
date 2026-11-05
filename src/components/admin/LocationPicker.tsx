import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { validCoordinates } from "../../../shared/location.js";
import MapPointLink from "../MapPointLink";
import "./location-picker.css";
function Pick({
  point,
  onChange,
}: {
  point: [number, number] | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView(point, Math.max(map.getZoom(), 15));
  }, [map, point?.[0], point?.[1]]);
  useMapEvents({
    click: (event) => {
      if (
        event.originalEvent.target instanceof Element &&
        event.originalEvent.target.closest("fieldset[disabled]")
      )
        return;
      onChange(
        Number(event.latlng.lat.toFixed(6)),
        Number(event.latlng.lng.toFixed(6)),
      );
    },
  });
  return point ? (
    <CircleMarker center={point} radius={9}>
      <Popup>Izbrana lokacija</Popup>
    </CircleMarker>
  ) : null;
}
export default function LocationPicker({
  latitude,
  longitude,
  onChange,
  optional = true,
  label = "Lokacija na zemljevidu",
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  optional?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const point = validCoordinates(latitude, longitude)
    ? ([latitude!, longitude!] as [number, number])
    : null;
  return (
    <section className="admin-location-picker admin-field-wide">
      <h3>{label}</h3>
      <p>Kliknite mesto na zemljevidu. Točko lahko popravite z novim klikom.</p>
      <div className="admin-location-actions">
        <button
          type="button"
          className="admin-button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open
            ? "Zapri zemljevid"
            : point
              ? "Popravi točko na zemljevidu"
              : "Izberi točko na zemljevidu"}
        </button>
        {point && <MapPointLink latitude={latitude} longitude={longitude} />}{" "}
        {point && optional && (
          <button
            type="button"
            className="admin-button"
            onClick={() => onChange(null, null)}
          >
            Odstrani točko
          </button>
        )}
      </div>
      {open && (
        <MapContainer
          center={point || [45.962, 14.298]}
          zoom={point ? 16 : 12}
          scrollWheelZoom={false}
          className="admin-location-map"
          aria-label="Izberite točno lokacijo"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Pick point={point} onChange={onChange} />
        </MapContainer>
      )}
      <details>
        <summary>Vnos koordinat za natančen popravek</summary>
        <div className="admin-field-grid">
          {(["latitude", "longitude"] as const).map((key) => (
            <label key={key} className="admin-field">
              <span>
                {key === "latitude"
                  ? "Zemljepisna širina"
                  : "Zemljepisna dolžina"}
              </span>
              <input
                type="number"
                step="any"
                min={key === "latitude" ? -90 : -180}
                max={key === "latitude" ? 90 : 180}
                value={(key === "latitude" ? latitude : longitude) ?? ""}
                onChange={(e) => {
                  const next =
                    e.target.value === "" ? null : Number(e.target.value);
                  onChange(
                    key === "latitude" ? next : latitude,
                    key === "longitude" ? next : longitude,
                  );
                }}
              />
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}
