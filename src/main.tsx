import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadAttempt } from './attempt/storage';
import { examFor, examProblems, loadProblemCode } from './content/bank';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './index.css';

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// An attempt in progress opens straight where it was left, without a loading screen. If its code
// cannot load, the app starts anyway and offers to try again.
const saved = loadAttempt(Date.now());
const exam = saved && examFor(saved);
void Promise.all((exam ? examProblems(exam) : []).map(loadProblemCode))
  .catch(() => {})
  .then(render);

// Only in the built site, as the development server changes its files all the time.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {
    // The app works the same without it, only not offline.
  });
}
