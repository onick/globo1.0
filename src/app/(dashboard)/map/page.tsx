import { TrackingMap } from "@/components/map/tracking-map";

export default function MapPage() {
  return (
    <div style={{ height: "calc(100vh - 5rem)", margin: "-20px" }}>
      <TrackingMap />
    </div>
  );
}
