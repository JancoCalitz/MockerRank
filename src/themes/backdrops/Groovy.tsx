// A giant rotating sunburst, flowing wavy stripes, lava-lamp blobs, and flickering film grain.

const STRIPES = ['#b5470f', '#e0aa26', '#788c32', '#563c22'];

// One wave repeated twice across, so sliding it by half its width loops without a seam.
function Waves() {
  const wave = (offset: number) => {
    const y = 20 + offset * 22;
    return `M0 ${y} Q 150 ${y - 18} 300 ${y} T 600 ${y} T 900 ${y} T 1200 ${y} T 1500 ${y} T 1800 ${y} T 2100 ${y} T 2400 ${y}`;
  };
  return (
    <svg className="groovy-waves" viewBox="0 0 2400 120" preserveAspectRatio="none">
      {STRIPES.map((colour, index) => (
        <path key={colour} d={wave(index)} fill="none" stroke={colour} strokeWidth="18" />
      ))}
    </svg>
  );
}

const BLOBS = [
  { left: '8%', size: 220, colour: '#c8541a', delay: '0s' },
  { left: '70%', size: 280, colour: '#e0aa26', delay: '-14s' },
  { left: '40%', size: 180, colour: '#788c32', delay: '-26s' },
  { left: '86%', size: 150, colour: '#b5470f', delay: '-8s' },
];

export default function Groovy() {
  return (
    <>
      <div className="groovy-sunburst" />
      {BLOBS.map(({ left, size, colour, delay }) => (
        <div
          key={left}
          className="groovy-blob"
          style={{
            left,
            width: size,
            height: size * 1.2,
            background: colour,
            animationDelay: delay,
          }}
        />
      ))}
      <Waves />
      <div className="groovy-grain" />
    </>
  );
}
