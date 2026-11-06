import { lazy, Suspense, type ComponentType } from 'react';
import { usePreference, useTheme } from './store.ts';

// Each theme's moving background, loaded only when that theme is chosen. Their styles live in the
// theme's CSS file. Themes without one (Classic, and the 80s theme, which draws its own in CSS)
// show nothing here.
const SCENES: Record<string, ComponentType> = {
  diner50s: lazy(() => import('./backdrops/Diner.tsx')),
  mod60s: lazy(() => import('./backdrops/Mod.tsx')),
  groovy70s: lazy(() => import('./backdrops/Groovy.tsx')),
  desktop90s: lazy(() => import('./backdrops/Desktop.tsx')),
  aero00s: lazy(() => import('./backdrops/Aero.tsx')),
  flat10s: lazy(() => import('./backdrops/Flat.tsx')),
  aurora20s: lazy(() => import('./backdrops/Aurora.tsx')),
  'aurora20s-light': lazy(() => import('./backdrops/Aurora.tsx')),
};

export function Backdrop() {
  const theme = useTheme();
  const effects = usePreference('effects');
  const Scene = SCENES[theme.id];
  if (!Scene || !effects) return null;
  return (
    <div className="theme-backdrop" aria-hidden="true">
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </div>
  );
}
