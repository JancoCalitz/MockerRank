import type { StoredJudgeResult, StoredTestResult } from '../attempt/attempt.ts';
import type { CodingProblem } from '../content/schema.ts';
import type { Verdict } from '../runner/judge.ts';

const VERDICT_LABELS: Record<Verdict, string> = {
  accepted: 'Accepted',
  'wrong-answer': 'Wrong Answer',
  'time-limit': 'Time Limit Exceeded',
  'memory-limit': 'Memory Limit Exceeded',
  'runtime-error': 'Runtime Error',
};

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <pre className="mt-0.5 max-h-40 overflow-auto rounded bg-slate-100 p-2 font-mono text-xs whitespace-pre-wrap">
        {text || '(empty)'}
      </pre>
    </div>
  );
}

function TestRow({
  name,
  result,
  input,
  expected,
  showDetails,
}: {
  name: string;
  result: StoredTestResult | undefined;
  input: string;
  expected: string;
  showDetails: boolean;
}) {
  const accepted = result?.verdict === 'accepted';
  return (
    <details
      className="rounded border border-slate-200 p-2"
      open={result && !accepted && showDetails}
    >
      <summary className="cursor-pointer text-sm">
        <span className="font-medium">{name}</span>
        {result && (
          <>
            {': '}
            <span className={accepted ? 'text-emerald-700' : 'text-red-700'}>
              {VERDICT_LABELS[result.verdict]}
            </span>
            <span className="ml-2 text-xs text-slate-500">
              {result.timeMs} ms
              {result.memoryKb !== null && `, ${Math.round(result.memoryKb / 1024)} MB`}
            </span>
          </>
        )}
      </summary>
      {showDetails ? (
        <>
          <Block label="Input" text={input} />
          <Block label="Expected output" text={expected} />
          {result && <Block label="Your output" text={result.stdout} />}
          {result?.stderr && <Block label="Errors" text={result.stderr} />}
        </>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          This test is hidden. Its input and output are not shown.
        </p>
      )}
    </details>
  );
}

interface TestResultsProps {
  problem: CodingProblem;
  result: StoredJudgeResult | undefined;
  kind: 'run' | 'submission';
  showHidden: boolean;
}

export function TestResults({ problem, result, kind, showHidden }: TestResultsProps) {
  if (result && !result.compiled) {
    return (
      <div>
        <p className="text-sm font-semibold text-red-700">Compilation Error</p>
        <Block label="Compiler output" text={result.compileOutput} />
      </div>
    );
  }

  const sampleCount = problem.sampleTests.length;
  // A run only covers the samples, but hidden tests can still be revealed for study.
  const includeHidden = kind === 'submission' ? Boolean(result) : showHidden;
  const tests = [...problem.sampleTests, ...(includeHidden ? problem.hiddenTests : [])];
  const passed = result?.tests.filter((test) => test.verdict === 'accepted').length ?? 0;

  if (!result && tests.length === 0) return null;

  return (
    <div className="space-y-1">
      {result && (
        <p className="text-sm font-semibold">
          {kind === 'submission' ? 'Submission' : 'Sample tests'}: {passed} of {result.tests.length}{' '}
          tests passed
        </p>
      )}
      {tests.map((test, index) => {
        const isSample = index < sampleCount;
        return (
          <TestRow
            key={index}
            name={isSample ? `Sample test ${index + 1}` : `Hidden test ${index - sampleCount + 1}`}
            result={result?.tests[index]}
            input={test.input}
            expected={test.output}
            showDetails={isSample || showHidden}
          />
        );
      })}
    </div>
  );
}
