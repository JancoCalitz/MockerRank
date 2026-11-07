// Built from the YAML files by scripts/content-plugin.ts.
declare module 'virtual:question-bank' {
  import type { CodingProblem, Exam, Mcq } from './content/schema.ts';

  export const mcqs: Mcq[];
  export const problems: CodingProblem[];
  export const exams: Exam[];
  export const codeLoaders: Record<string, () => Promise<{ default: CodingProblem['languages'] }>>;
}

// Whether this build is locked with a password, and where its encrypted questions are.
declare module 'virtual:content-lock' {
  export const contentLock: { locked: boolean; file: string };
}
