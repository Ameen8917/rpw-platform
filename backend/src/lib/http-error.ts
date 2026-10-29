/* An error that maps directly to an HTTP response:
   { "error": { "code", "message", "details?" } } */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  static badRequest(message: string, details?: unknown) { return new HttpError(400, "validation_error", message, details); }
  static unauthorized(message = "Sign in required") { return new HttpError(401, "unauthorized", message); }
  static forbidden(message = "You do not have permission to do this") { return new HttpError(403, "forbidden", message); }
  static notFound(message = "Not found") { return new HttpError(404, "not_found", message); }
  static conflict(message: string) { return new HttpError(409, "conflict", message); }
}
