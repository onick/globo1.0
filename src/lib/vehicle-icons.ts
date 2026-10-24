import { Bus, Car, Motorbike, Navigation, Truck, Van, type LucideIcon } from "lucide-react";

// Icon for each vehicle type (src/lib/vehicle-types.ts), on the map and in the lists.
// Vehicles without a type get a neutral one, so it's clear the type is missing.
const ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  van: Van,
  car: Car,
  pickup: Truck,
  motorcycle: Motorbike,
  bus: Bus,
};

export function vehicleIcon(type: string | null | undefined): LucideIcon {
  return (type && ICONS[type]) || Navigation;
}
