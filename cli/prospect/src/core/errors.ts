export class CliError extends Error {
  exitCode: number;
  status?: number;
  details?: unknown;

  constructor(message: string, exitCode = 1, options: { status?: number; details?: unknown } = {}) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.status = options.status;
    this.details = options.details;
  }
}
