// Picks which coding problems the browser validator should check, so a small content change does
// not need a full run. With no arguments, it checks everything.
export function selectProblems(
  allIds: readonly string[],
  args: readonly string[],
  changedFiles: readonly string[],
): string[] {
  const named = args.filter((arg) => !arg.startsWith('--'));
  const unknown = named.filter((id) => !allIds.includes(id));
  if (unknown.length > 0) throw new Error(`Unknown problem: ${unknown.join(', ')}`);

  const wanted = new Set(named);
  if (args.includes('--changed')) {
    for (const file of changedFiles) {
      const match =
        /^content\/(?:coding\/([a-z0-9-]+)\.ya?ml|tests\/([a-z0-9-]+)-large\.(?:in|out))$/.exec(
          file,
        );
      const id = match?.[1] ?? match?.[2];
      if (id && allIds.includes(id)) wanted.add(id);
    }
    return allIds.filter((id) => wanted.has(id));
  }
  return named.length > 0 ? allIds.filter((id) => wanted.has(id)) : [...allIds];
}
