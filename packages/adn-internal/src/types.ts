export type AdnHandlerError = {
  status: number;
  message: string;
  error_code?: string;
  extra?: Record<string, unknown>;
};

export type AdnHandlerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AdnHandlerError };
