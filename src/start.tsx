import { App } from './App';
import { loadAttempt } from './attempt/storage';
import { examFor, examProblems, loadProblemCode } from './content/bank';

// The app and everything that reads the question bank. main.tsx loads this only once the bank is
// available, which on a locked site means after the password is entered.
//
// An attempt in progress opens straight where it was left, without a loading screen. If its code
// cannot load, the app starts anyway and offers to try again.
export async function startApp() {
  const saved = loadAttempt(Date.now());
  const exam = saved && examFor(saved);
  await Promise.all((exam ? examProblems(exam) : []).map(loadProblemCode)).catch(() => {});
  return <App />;
}
