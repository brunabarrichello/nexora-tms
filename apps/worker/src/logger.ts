export type LogFields = Record<string, unknown>;

type Level = 'debug' | 'info' | 'warn' | 'error';

export class StructuredLogger {
  constructor(
    private readonly workerId: string,
    private readonly environment: string,
  ) {}

  debug(event: string, fields: LogFields = {}): void {
    this.write('debug', event, fields);
  }

  info(event: string, fields: LogFields = {}): void {
    this.write('info', event, fields);
  }

  warn(event: string, fields: LogFields = {}): void {
    this.write('warn', event, fields);
  }

  error(event: string, fields: LogFields = {}): void {
    this.write('error', event, fields);
  }

  private write(level: Level, event: string, fields: LogFields): void {
    const record = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'nexora-tms-worker',
      environment: this.environment,
      workerId: this.workerId,
      event,
      ...fields,
    });

    if (level === 'error') {
      console.error(record);
      return;
    }
    if (level === 'warn') {
      console.warn(record);
      return;
    }
    console.log(record);
  }
}

export function errorFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };
  }

  return { errorMessage: String(error) };
}
