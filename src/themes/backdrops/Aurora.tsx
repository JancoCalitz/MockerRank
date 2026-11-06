import { useEffect, useRef } from 'react';

// A slowly morphing aurora, a soft spotlight that follows the pointer, and drifting particles.

const BLOBS = [
  { left: '-15%', top: '-20%', colour: 'var(--aurora-a)', delay: '0s' },
  { left: '50%', top: '-25%', colour: 'var(--aurora-b)', delay: '-9s' },
  { left: '20%', top: '45%', colour: 'var(--aurora-c)', delay: '-17s' },
  { left: '65%', top: '40%', colour: 'var(--aurora-d)', delay: '-5s' },
];

// Fixed positions, so the particles do not jump about when the page renders again.
const PARTICLES = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  top: `${40 + ((index * 53) % 60)}%`,
  delay: `${-((index * 7) % 24)}s`,
}));

export default function Aurora() {
  const spotlight = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (document.documentElement.dataset.calm === 'true') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        spotlight.current?.style.setProperty('--x', `${event.clientX}px`);
        spotlight.current?.style.setProperty('--y', `${event.clientY}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <>
      {BLOBS.map(({ left, top, colour, delay }) => (
        <div
          key={left}
          className="aurora-blob"
          style={{ left, top, background: colour, animationDelay: delay }}
        />
      ))}
      <div ref={spotlight} className="aurora-spotlight" />
      {PARTICLES.map(({ left, top, delay }, index) => (
        <div key={index} className="aurora-particle" style={{ left, top, animationDelay: delay }} />
      ))}
    </>
  );
}
