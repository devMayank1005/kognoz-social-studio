// Which brand the studio is currently producing for.
//
// The v4 reference artifact switches brands by mutating module-level bindings
// and remounting the app with `key={brandId}`. That is not available here — see
// the header of lib/brands.ts for why module mutation is unsafe once there is a
// server — so the brand travels as context and components read it with
// `useBrand()`.
//
// PERSISTENCE, AND WHY IT IS TWO-STAGE.
//
// The choice is stored twice on purpose. `localStorage` answers instantly and is
// what stops the page painting Kognoz blue for a frame before switching; the
// server blob under `studio-brand` is what carries the choice to the user's
// other machine. The server wins when they disagree, because it is the one a
// person can see and fix.
//
// The first render MUST match what the server rendered, or hydration throws a
// mismatch and React discards the tree. So the state starts at the default and
// the stored value is applied in a layout effect, which runs after hydration but
// before the browser paints. The result is no mismatch and no visible flash.
"use client";

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { BRANDS, DEFAULT_BRAND_ID, brandFor, isBrandId, type Brand, type BrandId } from "@/lib/brands";
import { storeGet, storeSet } from "@/lib/storeClient";

/** The key both this app and the v4 reference use, so a saved choice carries over. */
export const BRAND_KEY = "studio-brand";

/** useLayoutEffect warns when it runs during SSR, where it does nothing anyway. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface BrandContextValue {
  brand: Brand;
  brandId: BrandId;
  setBrandId: (id: BrandId) => void;
  /** False until the stored choice has been applied, for callers that must not read stale keys. */
  ready: boolean;
}

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brandId, setBrandIdState] = useState<BrandId>(DEFAULT_BRAND_ID);
  const [ready, setReady] = useState(false);

  // Stage one: the local copy, before paint.
  //
  // Two writers share this key and they disagree about encoding. Line ~92 below writes the
  // raw id (`konverz`); lib/storeClient.ts:61 writes `JSON.stringify(value)` for every key
  // it mirrors, which is `"konverz"` WITH quotes — and it writes last, so that is what is
  // actually in storage. Reading it raw therefore always failed `isBrandId`, stage one
  // always fell through to the default, and the brand only came back once the SERVER
  // answered. With the server unreachable it never came back at all, and the whole point
  // of stage one — no flash of the wrong brand — was quietly lost.
  //
  // Accepting both encodings is the small fix. Making the two writers agree is the real
  // one, and belongs with whoever owns storeClient's local mirror.
  useIsomorphicLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem(BRAND_KEY);
      let saved: unknown = raw;
      if (typeof raw === "string" && raw.startsWith('"')) {
        try {
          saved = JSON.parse(raw);
        } catch {
          saved = raw;
        }
      }
      if (isBrandId(saved) && saved !== DEFAULT_BRAND_ID) setBrandIdState(saved);
    } catch {
      /* private mode, or storage disabled. The default is a fine answer. */
    }
    setReady(true);
  }, []);

  /**
   * Publish the brand to CSS.
   *
   * Every chrome surface reads `--rail`, `--brand-accent` and friends, which are redefined
   * under `:root[data-brand="konverz"]`. Setting the attribute here means a brand switch
   * repaints the whole frame at once: no component subscribes, nothing re-renders, and
   * there is no frame where the rail has switched and the buttons have not.
   *
   * A layout effect for the same reason stage one is: after hydration, before paint.
   */
  useIsomorphicLayoutEffect(() => {
    document.documentElement.dataset.brand = brandId;
  }, [brandId]);

  // Stage two: the shared copy. Authoritative, so it overrides stage one.
  useEffect(() => {
    let cancelled = false;
    storeGet<BrandId>(BRAND_KEY)
      .then((r) => {
        if (cancelled || r.stale) return;
        if (isBrandId(r.value)) setBrandIdState(r.value);
      })
      .catch(() => {
        /* offline. The local copy stands. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setBrandId = useCallback((id: BrandId) => {
    if (!isBrandId(id)) return;
    setBrandIdState(id);
    try {
      window.localStorage.setItem(BRAND_KEY, id);
    } catch {
      /* see above */
    }
    // Fire and forget: a failed sync must not block the switch, and the local
    // copy already holds it.
    storeSet(BRAND_KEY, id).catch(() => {});
  }, []);

  const value = useMemo<BrandContextValue>(
    () => ({ brand: brandFor(brandId), brandId, setBrandId, ready }),
    [brandId, setBrandId, ready]
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

/**
 * The active brand.
 *
 * Falls back to the default outside a provider rather than throwing: a renderer
 * used in isolation (a test, an export harness) should draw a Kognoz slide, not
 * crash.
 */
export function useBrand(): Brand {
  return useContext(BrandContext)?.brand ?? BRANDS[DEFAULT_BRAND_ID];
}

export function useBrandSwitch(): BrandContextValue {
  const ctx = useContext(BrandContext);
  return ctx ?? { brand: BRANDS[DEFAULT_BRAND_ID], brandId: DEFAULT_BRAND_ID, setBrandId: () => {}, ready: true };
}
