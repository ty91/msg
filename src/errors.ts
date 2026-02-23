export type MsgErrorCode =
  | "CONFIG_NOT_FOUND"
  | "CONFIG_INVALID"
  | "DAEMON_UNAVAILABLE"
  | "DAEMON_START_FAILED"
  | "DAEMON_BAD_RESPONSE"
  | "INVALID_REQUEST"
  | "SLACK_SOCKET_MODE_FAILED"
  | "SLACK_POST_FAILED"
  | "UNKNOWN_ERROR";

export class MsgError extends Error {
  readonly code: MsgErrorCode;

  constructor(code: MsgErrorCode, message?: string) {
    super(message ?? code);
    this.name = "MsgError";
    this.code = code;
  }
}

export function toErrorCode(error: unknown): MsgErrorCode {
  if (error instanceof MsgError) {
    return error.code;
  }

  return "UNKNOWN_ERROR";
}
