// Op-art circles and stripes, shifting halftone dots, and flower-power shapes that bloom.

function Flower({ petal, centre, size }: { petal: string; centre: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100">
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy="-26"
          rx="16"
          ry="26"
          fill={petal}
          transform={`rotate(${angle})`}
        />
      ))}
      <circle r="16" fill={centre} />
    </svg>
  );
}

const FLOWERS = [
  { left: '4%', top: '70%', size: 110, petal: '#ff6b1a', centre: '#f2b705', delay: '0s' },
  { left: '86%', top: '14%', size: 90, petal: '#00897b', centre: '#ff6b1a', delay: '-3.5s' },
  { left: '74%', top: '76%', size: 70, petal: '#f2b705', centre: '#000000', delay: '-6s' },
  { left: '10%', top: '12%', size: 60, petal: '#000000', centre: '#f2b705', delay: '-8s' },
];

export default function Mod() {
  return (
    <>
      <div className="mod-halftone" />
      <div
        className="mod-target"
        style={{ width: '70vmax', height: '70vmax', left: '-25vmax', top: '-30vmax' }}
      />
      <div
        className="mod-target pulse"
        style={{ width: '40vmax', height: '40vmax', right: '-12vmax', top: '30vh' }}
      />
      <div className="mod-stripes" />
      {FLOWERS.map(({ left, top, size, petal, centre, delay }) => (
        <div key={left} className="mod-flower" style={{ left, top, animationDelay: delay }}>
          <Flower petal={petal} centre={centre} size={size} />
        </div>
      ))}
    </>
  );
}
