declare module 'node-fetch' {
  export interface Response {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Headers;
    url: string;
    json(): Promise<any>;
    text(): Promise<string>;
    buffer(): Promise<Buffer>;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
  }

  export interface RequestInit {
    method?: string;
    headers?: { [key: string]: string } | Headers;
    body?: string | Buffer | Blob | ArrayBuffer | FormData | NodeJS.ReadableStream;
    redirect?: 'follow' | 'error' | 'manual';
    signal?: AbortSignal;
    timeout?: number;
    size?: number;
    follow?: number;
    compress?: boolean;
    agent?: any;
  }

  export interface Headers {
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
    forEach(callback: (value: string, name: string) => void): void;
  }

  function fetch(url: string | Request, init?: RequestInit): Promise<Response>;
  export default fetch;
} 