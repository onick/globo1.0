"use client";

import { useState } from "react";

// Current page of a filtered list that goes back to page 1 whenever `key` (the filters)
// changes. Derived during render instead of resetting it from an effect, which would
// render once with the stale page first.
export function usePageResetOn(key: string): [number, (page: number) => void] {
  const [state, setState] = useState({ key, page: 1 });
  const page = state.key === key ? state.page : 1;
  return [page, (next: number) => setState({ key, page: next })];
}
