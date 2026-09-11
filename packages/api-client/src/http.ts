import axios, { isAxiosError } from "axios";

export const HASUT_HTTP_TIMEOUT_MS = 15_000;
export const HASUT_UPLOAD_TIMEOUT_MS = 60_000;

export interface HasutHttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  data?: unknown;
  timeoutMs?: number;
}

export interface HasutHttpResponse {
  status: number;
  data: unknown;
}

export interface HasutHttpAdapter {
  request(input: HasutHttpRequest): Promise<HasutHttpResponse>;
}

export function createAxiosHttpAdapter(): HasutHttpAdapter {
  const instance = axios.create({
    timeout: HASUT_HTTP_TIMEOUT_MS,
    validateStatus: () => true,
  });

  return {
    async request(input: HasutHttpRequest): Promise<HasutHttpResponse> {
      try {
        const response = await instance.request({
          url: input.url,
          method: input.method,
          headers: input.headers,
          data: input.data,
          timeout: input.timeoutMs ?? HASUT_HTTP_TIMEOUT_MS,
          validateStatus: () => true,
        });
        return { status: response.status, data: response.data };
      } catch (error) {
        if (isAxiosError(error) && error.response !== undefined) {
          return { status: error.response.status, data: error.response.data };
        }
        throw error;
      }
    },
  };
}
