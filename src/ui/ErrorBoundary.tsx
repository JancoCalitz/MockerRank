import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

// A part of the app failing, such as the editor not downloading, should not leave a blank page.
// Answers are saved as they change, so reloading loses nothing.
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="mx-auto max-w-xl p-8 font-sans text-slate-900">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-slate-700">
          This part of the app could not load, which can happen if your internet connection dropped.
          Your answers are saved in this browser, so reloading will not lose them.
        </p>
        <button
          type="button"
          className="mt-4 ui-btn ui-btn-primary rounded bg-emerald-700 px-4 py-2 font-semibold text-white"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </main>
    );
  }
}
