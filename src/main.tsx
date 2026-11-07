import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { contentLocked, unlockRemembered } from './content/lock';
import { Backdrop } from './themes/Backdrop';
import './themes/store';
import { ThemeEffects } from './themes/ThemeEffects';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { LockScreen } from './ui/LockScreen';
import './index.css';

const root = createRoot(document.getElementById('root')!);

function show(content: ReactNode) {
  root.render(
    <StrictMode>
      <ErrorBoundary>{content}</ErrorBoundary>
      <Backdrop />
      <ThemeEffects />
    </StrictMode>,
  );
}

// Nothing that reads the question bank loads before this, so a locked site shows only the lock
// screen until the password is entered.
async function start() {
  const { startApp } = await import('./start');
  show(await startApp());
}

if (contentLocked) {
  void unlockRemembered().then((unlocked) => {
    if (unlocked) void start();
    else show(<LockScreen onUnlocked={() => void start()} />);
  });
} else {
  void start();
}

// Only in the built site, as the development server changes its files all the time.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {
    // The app works the same without it, only not offline.
  });
}
