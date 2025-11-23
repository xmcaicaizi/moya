const DEBUG_ENABLED = import.meta.env.VITE_MOYA_DEBUG !== 'false';

type LogLevel = 'info' | 'warn' | 'error';

const format = (level: LogLevel, scope: string, message: string) => {
  const base = `[Moya][${level.toUpperCase()}][${scope}]`;
  return `${base} ${message}`;
};

const log =
  (level: LogLevel) =>
  (scope: string, message: string, payload?: unknown) => {
    if (!DEBUG_ENABLED && level === 'info') return;
    const args: unknown[] = [format(level, scope, message)];
    if (payload !== undefined) args.push(payload);
    const fn =
      level === 'info'
        ? console.log
        : level === 'warn'
        ? console.warn
        : console.error;
    fn(...args);
  };

export const logger = {
  info: log('info'),
  warn: log('warn'),
  error: log('error'),
};

export const explainEnvHint = (key: string, hint: string) =>
  `[缺少 ${key}] ${hint}`;

