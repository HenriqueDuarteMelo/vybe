// Dev uses the Vite proxy (relative "/api"). In production the SPA is on
// Vercel and the API lives on its own host, so VITE_API_URL (build-time) points
// at it — audio streams and the API both go straight from the browser.
const API_ROOT = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const API_BASE = `${API_ROOT}/api`;

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(options: FetchOptions): HeadersInit {
    const headers: HeadersInit = { ...options.headers };

    const isForm = options.body instanceof FormData;
    const hasBody = options.body !== undefined && options.body !== null;
    if (!isForm && hasBody) {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    const token = options.token || localStorage.getItem("vybe_token");
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { token: _token, ...fetchOptions } = options;
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers: this.getHeaders(options),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  get<T>(path: string, options?: FetchOptions) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(path, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string, options?: FetchOptions) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  getStreamUrl(trackId: string): string {
    return `${this.baseUrl}/tracks/${trackId}/stream`;
  }

  getYoutubeProxyUrl(videoId: string): string {
    return `${this.baseUrl}/stream/youtube/direct?videoId=${encodeURIComponent(videoId)}`;
  }

  getProxyStreamUrl(audioUrl: string): string {
    return `${this.baseUrl}/stream/proxy?url=${encodeURIComponent(audioUrl)}`;
  }
}

export const api = new ApiClient(API_BASE);
