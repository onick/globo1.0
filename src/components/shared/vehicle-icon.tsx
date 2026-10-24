import { createElement } from "react";
import type { LucideProps } from "lucide-react";
import { vehicleIcon } from "@/lib/vehicle-icons";

// The icon of a vehicle type (truck, motorbike, car…), for lists and panels
export function VehicleIcon({ vehicleType, ...props }: { vehicleType: string | null | undefined } & LucideProps) {
  return createElement(vehicleIcon(vehicleType), props);
}
