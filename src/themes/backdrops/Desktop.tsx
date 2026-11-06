import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Tiled wallpaper, a marquee of study tips behind a blinking prompt, and a starfield screensaver
// after a while with no input.

const TIPS = [
  'Ctrl+Enter runs your code, and Ctrl+Shift+Enter submits it.',
  'Flag a question you want to come back to before you submit.',
  'Read the constraints first: they tell you how fast the solution must be.',
  'Hidden tests like edge cases: empty input, one item, repeated values, the largest n.',
  'Run the sample tests before you submit, then think about what they do not cover.',
  'Topic drill repeats the questions you got wrong until you get them right.',
];

const IDLE_MS = 30_000;
const STARS = 220;

function Starfield() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current!;
    const context = element.getContext('2d');
    if (!context) return;
    const stars = Array.from({ length: STARS }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
    }));
    let frame = 0;
    const draw = () => {
      const { innerWidth: width, innerHeight: height } = window;
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      context.fillStyle = '#000';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#fff';
      for (const star of stars) {
        star.z -= 0.006;
        if (star.z <= 0.02) {
          star.x = Math.random() * 2 - 1;
          star.y = Math.random() * 2 - 1;
          star.z = 1;
        }
        const x = width / 2 + (star.x / star.z) * (width / 2);
        const y = height / 2 + (star.y / star.z) * (height / 2);
        const size = (1 - star.z) * 3;
        context.fillRect(x, y, size, size);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvas} />;
}

// Starts after IDLE_MS without input, but never during a test or problem (data-calm), and stops
// on any input. A click that wakes the screen is not passed on to what is underneath.
function Screensaver() {
  const [asleep, setAsleep] = useState(false);

  useEffect(() => {
    let timer = 0;
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const calm = document.documentElement.dataset.calm === 'true';
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!calm && !reduced && !document.hidden) setAsleep(true);
        else restart();
      }, IDLE_MS);
    };
    const wake = () => {
      setAsleep(false);
      restart();
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const name of events) window.addEventListener(name, wake, { passive: true });
    restart();
    return () => {
      window.clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, wake);
    };
  }, []);

  if (!asleep) return null;
  return createPortal(
    <div
      className="desktop-screensaver"
      aria-hidden="true"
      onPointerDown={() => {
        const swallow = (event: Event) => event.stopPropagation();
        window.addEventListener('click', swallow, { capture: true, once: true });
        // The browser may not send a click at all, so a later, real click is never swallowed.
        window.setTimeout(() => window.removeEventListener('click', swallow, true), 500);
      }}
    >
      <Starfield />
    </div>,
    document.body,
  );
}

export default function Desktop() {
  return (
    <>
      <div className="desktop-wallpaper" />
      <div className="desktop-marquee">
        <span className="desktop-prompt">
          C:\MOCKER&gt;<span className="desktop-cursor">█</span>
        </span>
        <span className="desktop-scroll">{TIPS.join('     ★     ')}</span>
      </div>
      <Screensaver />
    </>
  );
}
