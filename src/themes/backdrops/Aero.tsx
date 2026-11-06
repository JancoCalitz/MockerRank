// A bright sky with drifting clouds, rising bubbles, lens-flare glints, and water shimmer.

const CLOUDS = [
  { top: '8%', width: 260, delay: '0s', duration: '95s' },
  { top: '18%', width: 180, delay: '-40s', duration: '120s' },
  { top: '30%', width: 320, delay: '-70s', duration: '110s' },
  { top: '12%', width: 140, delay: '-20s', duration: '140s' },
];

const BUBBLES = [
  { left: '6%', size: 34, delay: '0s' },
  { left: '18%', size: 18, delay: '-5s' },
  { left: '33%', size: 26, delay: '-11s' },
  { left: '58%', size: 40, delay: '-3s' },
  { left: '71%', size: 16, delay: '-8s' },
  { left: '84%', size: 30, delay: '-14s' },
  { left: '93%', size: 22, delay: '-1s' },
];

export default function Aero() {
  return (
    <>
      <div className="aero-flare" style={{ left: '6%', top: '4%', width: 220, height: 220 }} />
      <div
        className="aero-flare"
        style={{ left: '15%', top: '16%', width: 60, height: 60, animationDelay: '-2s' }}
      />
      {CLOUDS.map(({ top, width, delay, duration }) => (
        <div
          key={top + width}
          className="aero-cloud"
          style={{ top, width, animationDelay: delay, animationDuration: duration }}
        />
      ))}
      {BUBBLES.map(({ left, size, delay }) => (
        <div
          key={left}
          className="aero-bubble"
          style={{ left, width: size, height: size, animationDelay: delay }}
        />
      ))}
      <div className="aero-water" />
    </>
  );
}
