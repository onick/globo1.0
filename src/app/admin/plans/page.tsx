"use client";

import { useEffect, useState } from "react";

interface Plan {
  id: string;
  name: string;
  maxDevices: number;
  price: number;
  interval: string;
  active: boolean;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((res) => res.json())
      .then(setPlans);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plans</h1>
      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <p className="text-3xl font-bold mt-2">
              ${(plan.price / 100).toFixed(2)}
              <span className="text-sm text-zinc-500 font-normal">
                /{plan.interval}
              </span>
            </p>
            <p className="text-sm text-zinc-500 mt-2">
              Up to {plan.maxDevices} devices
            </p>
            <span
              className={`inline-block mt-3 px-2 py-1 rounded-full text-xs ${
                plan.active
                  ? "bg-green-100 text-green-700"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {plan.active ? "Active" : "Inactive"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
