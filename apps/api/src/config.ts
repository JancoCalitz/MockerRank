export interface Config {
  port: number;
  databasePath: string;
  judge0Url: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3000),
    databasePath: env.DATABASE_PATH ?? 'data/mockerrank.db',
    judge0Url: env.JUDGE0_URL ?? 'http://localhost:2358',
  };
}
