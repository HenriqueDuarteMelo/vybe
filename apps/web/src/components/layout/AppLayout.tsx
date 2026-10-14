import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { Sidebar } from "./Sidebar";
import { Player } from "../player/Player";
import { Search, History, LogOut } from "lucide-react";
import { useState } from "react";
import { ShowcaseSearch } from "../ShowcaseSearch";
import { usePlayerStore } from "../../stores/playerStore";
import type { Track } from "@vybe/shared";

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const playTrack = usePlayerStore((state) => state.playTrack);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleNavigate = (
    type: string,
    id: string,
    track?: Track,
    queue?: Track[]
  ) => {
    setSearchOpen(false);
    if (type === "artist") {
      const path = id.startsWith("deezer:") ? "/deezer/artist" : "/artist";
      navigate(`${path}/${id}`);
    } else if (type === "album") {
      const path = id.startsWith("deezer:") ? "/deezer/album" : "/album";
      navigate(`${path}/${id}`);
    } else if (type === "track" && track) {
      playTrack(track, queue ?? [track], 0);
      navigate("/");
    } else if (type === "genre") {
      navigate(`/search?genre=${id}`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-white/5 px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 max-w-xl">
                <div className="relative md:hidden">
                  <button
                    onClick={() => navigate("/search")}
                    className="w-full text-left bg-surface-100 rounded-full px-4 py-2 text-sm text-gray-400"
                  >
                    Search...
                  </button>
                </div>
                <div className="hidden md:block">
                  <ShowcaseSearch
                    onNavigate={(type, id) => {
                      handleNavigate(type, id);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/history"
                  className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-surface-100 transition-colors"
                  title="Listening history"
                >
                  <History className="w-5 h-5" />
                </Link>
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
                  <span className="w-8 h-8 rounded-full bg-vybe-600/30 flex items-center justify-center text-vybe-300 text-sm font-semibold">
                    {user?.username?.[0]?.toUpperCase() ?? "U"}
                  </span>
                  <div className="hidden lg:block">
                    <p className="text-sm text-white font-medium leading-tight">
                      {user?.username}
                    </p>
                    <p className="text-xs text-gray-500 leading-tight">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      navigate("/login");
                    }}
                    className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-surface-100 transition-colors"
                    title="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="px-6 py-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <Player />
    </div>
  );
}