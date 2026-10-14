import { create } from "zustand";
import type { Playlist } from "@vybe/shared";
import { getUserPlaylists } from "../services/playlists";

interface LibraryState {
  playlists: Playlist[];
  isLoading: boolean;
  loadPlaylists: () => Promise<void>;
  refreshPlaylists: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  playlists: [],
  isLoading: false,

  loadPlaylists: async () => {
    const token = localStorage.getItem("vybe_token");
    if (!token) {
      set({ playlists: [], isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      const playlists = await getUserPlaylists();
      set({ playlists, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  refreshPlaylists: async () => {
    const token = localStorage.getItem("vybe_token");
    if (!token) {
      set({ playlists: [], isLoading: false });
      return;
    }
    try {
      const playlists = await getUserPlaylists();
      set({ playlists });
    } catch {
      // keep existing playlists on failure
    }
  },
}));