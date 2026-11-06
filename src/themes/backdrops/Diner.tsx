// A neon diner sign, drifting boomerangs and atoms, twinkling starbursts, and a checkerboard floor.

function Boomerang({ colour }: { colour: string }) {
  return (
    <svg width="90" height="60" viewBox="0 0 90 60">
      <path d="M5 50 Q45 -10 85 50 Q45 25 5 50 Z" fill={colour} />
    </svg>
  );
}

function Atom() {
  return (
    <svg width="110" height="110" viewBox="-55 -55 110 110" fill="none" stroke="#40e0d0">
      <ellipse rx="50" ry="16" strokeWidth="2" />
      <ellipse rx="50" ry="16" strokeWidth="2" transform="rotate(60)" />
      <ellipse rx="50" ry="16" strokeWidth="2" transform="rotate(120)" />
      <circle r="6" fill="#ff4f6a" stroke="none" />
    </svg>
  );
}

function Starburst({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20">
      <path
        d="M0 -10 L1.5 -1.5 L10 0 L1.5 1.5 L0 10 L-1.5 1.5 L-10 0 L-1.5 -1.5 Z"
        fill="#fbf3dc"
      />
    </svg>
  );
}

const SHAPES = [
  { left: '6%', top: '18%', delay: '0s', shape: <Boomerang colour="#ff4f6a" /> },
  { left: '78%', top: '58%', delay: '-12s', shape: <Boomerang colour="#40e0d0" /> },
  { left: '12%', top: '62%', delay: '-20s', shape: <Atom /> },
  { left: '64%', top: '8%', delay: '-6s', shape: <Atom /> },
];

const STARS = [
  { left: '20%', top: '10%', size: 18, delay: '0s' },
  { left: '42%', top: '22%', size: 12, delay: '-1.3s' },
  { left: '88%', top: '34%', size: 20, delay: '-2.1s' },
  { left: '30%', top: '44%', size: 10, delay: '-0.7s' },
  { left: '56%', top: '38%', size: 14, delay: '-3.2s' },
  { left: '4%', top: '40%', size: 16, delay: '-2.6s' },
];

export default function Diner() {
  return (
    <>
      <div className="diner-floor" />
      {SHAPES.map(({ left, top, delay, shape }) => (
        <div
          key={`${left}${top}`}
          className="diner-shape"
          style={{ left, top, animationDelay: delay }}
        >
          {shape}
        </div>
      ))}
      {STARS.map(({ left, top, size, delay }) => (
        <div
          key={`${left}${top}`}
          className="diner-star"
          style={{ left, top, animationDelay: delay }}
        >
          <Starburst size={size} />
        </div>
      ))}
      <div className="diner-sign">Diner</div>
    </>
  );
}
