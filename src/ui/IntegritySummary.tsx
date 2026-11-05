import { formatDuration, type Attempt } from '../attempt/attempt.ts';
import { EVENT_LABELS, integritySummary } from '../attempt/integrity.ts';

export function IntegritySummary({ attempt }: { attempt: Attempt }) {
  const summary = integritySummary(attempt);
  const rows: [string, string | number][] = [
    ['Times you left the test', summary.departures],
    ['Time away', formatDuration(summary.awayMs)],
    ['Times you left full screen', summary.fullscreenExits],
    ['Copies from the editor', summary.copies],
    ['Pastes into the editor', summary.pastes],
    ['Right-clicks', summary.rightClicks],
    ['Window resizes', summary.resizes],
  ];

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Test conditions</h2>
      <p className="text-sm text-slate-600">
        What a real assessment might notice, so you can practise good habits. This does not affect
        your score.
        {attempt.requireFullscreen && ' Full screen was required.'}
      </p>
      <table aria-label="Test conditions" className="mt-2 w-full text-left text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-slate-100">
              <th scope="row" className="py-1 font-normal">
                {label}
              </th>
              <td className="py-1 text-right font-semibold tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {summary.events.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium">
            Timeline of the latest events
          </summary>
          <ol className="mt-1 max-h-60 overflow-y-auto text-xs text-slate-700">
            {summary.events.map((event, index) => (
              <li
                key={index}
                className="flex justify-between gap-3 border-b border-slate-100 py-0.5"
              >
                <span>
                  {EVENT_LABELS[event.type]}, on question {event.question}
                </span>
                <span className="tabular-nums">
                  {formatDuration(event.at - attempt.startedAt)} in
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
