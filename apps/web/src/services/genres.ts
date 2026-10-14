import { api } from "./api";
import type { Genre } from "@vybe/shared";

export async function getGenres(): Promise<Genre[]> {
  return api.get<Genre[]>("/genres");
}