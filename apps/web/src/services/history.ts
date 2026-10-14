import { api } from "./api";
import type { ListeningHistoryEntry } from "@vybe/shared";

export interface ListeningHistoryResponse {
  history: ListeningHistoryEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function recordListening(trackId: string): Promise<void> {
  return api.post("/history", { trackId });
}

export async function getHistory(
  page?: number,
  limit?: number
): Promise<ListeningHistoryResponse> {
  const searchParams = new URLSearchParams();
  if (page) searchParams.set("page", String(page));
  if (limit) searchParams.set("limit", String(limit));
  const qs = searchParams.toString();
  return api.get(`/history${qs ? `?${qs}` : ""}`);
}
