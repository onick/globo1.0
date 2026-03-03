import { Radio } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-base-200">
      {/* Left panel — brand strip */}
      <div className="hidden lg:flex w-[360px] bg-neutral flex-col justify-between p-8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-success/20 flex items-center justify-center">
            <Radio className="w-4 h-4 text-success" />
          </div>
          <span className="text-base font-semibold tracking-tight text-neutral-content">
            Globo GPS
          </span>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-neutral-content/50 leading-relaxed">
            Real-time fleet tracking for businesses in the Dominican Republic and beyond.
          </p>
          <div className="flex items-center gap-2">
            <span className="status status-success animate-pulse" />
            <span className="text-[11px] text-neutral-content/50 uppercase tracking-wider">
              System Online
            </span>
          </div>
        </div>
      </div>

      {/* Right — form area */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  );
}
