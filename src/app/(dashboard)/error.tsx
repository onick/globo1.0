"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="w-14 h-14 bg-error/10 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7 text-error" />
        </div>
        <h2 className="text-lg font-bold text-base-content">Something went wrong</h2>
        <p className="text-base-content/50 text-sm">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button onClick={reset} className="btn btn-primary btn-sm gap-2">
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
