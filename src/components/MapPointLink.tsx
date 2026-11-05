import { MapPin } from "lucide-react";
import { mapPointUrl, mapAddressUrl } from "../../shared/location.js";
export default function MapPointLink({
  latitude,
  longitude,
  address,
  label = "Odpri lokacijo v Google Zemljevidih",
  className = "text-link",
}: {
  latitude?: unknown;
  longitude?: unknown;
  address?: string;
  label?: string;
  className?: string;
}) {
  const href = mapPointUrl(latitude, longitude) || mapAddressUrl(address);
  if (!href) return null;
  return (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      <MapPin size={16} />
      {label}
    </a>
  );
}
