import { Suspense } from "react";
import { RouteHistory } from "@/components/history/route-history";

export default function HistoryPage() {
  // RouteHistory reads ?deviceId=&from=&to= from the URL
  return (
    <Suspense>
      <RouteHistory />
    </Suspense>
  );
}
