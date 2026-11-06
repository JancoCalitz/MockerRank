import { useEffect, useState } from 'react';
import { getPreference, useTheme } from './store.ts';

const RIPPLE_TARGETS = '.ui-btn, .ui-nav button';

// Material's ink ripple, spreading from where a button is pressed.
function useRipple() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const button = (event.target as Element).closest<HTMLElement>(RIPPLE_TARGETS);
      if (!button || button.matches(':disabled')) return;
      if (!getPreference('effects')) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const box = button.getBoundingClientRect();
      const size = Math.hypot(box.width, box.height) * 2;
      const ripple = document.createElement('span');
      ripple.className = 'flat-ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - box.left - size / 2}px`;
      ripple.style.top = `${event.clientY - box.top - size / 2}px`;
      button.append(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);
}

// The floating action button, shown once a page has scrolled a long way.
function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!shown) return null;
  return (
    <button
      type="button"
      className="flat-fab"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      ↑
    </button>
  );
}

function FlatEffects() {
  useRipple();
  return <BackToTop />;
}

// Behaviour a theme adds beyond styling.
export function ThemeEffects() {
  const theme = useTheme();
  return theme.id === 'flat10s' ? <FlatEffects /> : null;
}
