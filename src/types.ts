export type NotifyRequest = {
  type: "notify";
  message: string;
};

export type PingRequest = {
  type: "ping";
};

export type DaemonRequest = NotifyRequest | PingRequest;

export type NotifySuccessResponse = {
  ok: true;
};

export type NotifyErrorResponse = {
  ok: false;
  error: string;
};

export type NotifyResponse = NotifySuccessResponse | NotifyErrorResponse;

export type PingResponse = {
  ok: true;
  pid: number;
};

export type DaemonResponse = NotifyResponse | PingResponse;

export type MsgConfig = {
  slack: {
    appToken: string;
    botToken: string;
    defaultChannel: string;
  };
};

export type RuntimePaths = {
  dirPath: string;
  configPath: string;
  socketPath: string;
  pidPath: string;
};
