import { Suspense } from "react";
import { TrackingMap } from "@/components/map/tracking-map";

export default function MapPage() {
  return (
    <div style={{ height: "calc(100vh - 5rem)", margin: "-20px" }}>
      {/* TrackingMap reads ?history=1&deviceId=&from=&to= */}
      <Suspense>
        <TrackingMap />
      </Suspense>
    </div>
  );
}
