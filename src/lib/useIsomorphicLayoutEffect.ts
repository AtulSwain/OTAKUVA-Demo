import { useEffect, useLayoutEffect } from 'react';

/**
 * useLayoutEffect in the browser, useEffect on the server (where layout
 * effects don't run and React warns about them).
 *
 * Use it to apply browser-only cached state (localStorage) right after
 * hydration but before paint. Reading localStorage inside a useState
 * initializer instead makes the browser's first render differ from the
 * server HTML — a hydration error — which is what the signed-in header did.
 */
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
