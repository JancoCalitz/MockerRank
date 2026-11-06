import { useEffect, useRef } from 'react';

// Big flat shapes with long shadows. They glide slowly, and each layer moves at its own speed as
// the page scrolls.

// A circle with a long shadow falling away at 45 degrees.
function Disc({ size, colour }: { size: number; colour: string }) {
  const r = size / 2;
  return (
    <svg width={size * 2.2} height={size * 2.2} viewBox={`0 0 ${size * 2.2} ${size * 2.2}`}>
      <defs>
        <linearGradient id={`fade-${colour.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.16" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        x={0}
        y={r}
        width={size}
        height={size * 1.5}
        fill={`url(#fade-${colour.slice(1)})`}
        transform={`rotate(-45 ${r} ${r})`}
      />
      <circle cx={r} cy={r} r={r} fill={colour} />
    </svg>
  );
}

const LAYERS = [
  {
    speed: 0.15,
    shapes: [
      { left: '-4%', top: '12%', size: 220, colour: '#c5cae9', delay: '0s' },
      { left: '80%', top: '55%', size: 260, colour: '#b2dfdb', delay: '-15s' },
    ],
  },
  {
    speed: 0.35,
    shapes: [
      { left: '70%', top: '6%', size: 120, colour: '#ffcdd2', delay: '-8s' },
      { left: '12%', top: '70%', size: 90, colour: '#fff9c4', delay: '-22s' },
    ],
  },
];

export default function Flat() {
  const layers = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        layers.current.forEach((layer, index) => {
          if (layer)
            layer.style.transform = `translateY(${-window.scrollY * LAYERS[index]!.speed}px)`;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <>
      {LAYERS.map(({ shapes }, index) => (
        <div
          key={index}
          className="flat-layer"
          ref={(layer) => {
            layers.current[index] = layer;
          }}
        >
          {shapes.map(({ left, top, size, colour, delay }) => (
            <div key={colour} className="flat-shape" style={{ left, top, animationDelay: delay }}>
              <Disc size={size} colour={colour} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
