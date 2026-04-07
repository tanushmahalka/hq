export class CliError extends Error {
  readonly exitCode: number;
  readonly details?: unknown;
  readonly status?: number;
  readonly requestId?: string;

  constructor(
    message: string,
    exitCode = 1,
    options: {
      details?: unknown;
      status?: number;
      requestId?: string;
    } = {},
  ) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.details = options.details;
    this.status = options.status;
    this.requestId = options.requestId;
  }
}
