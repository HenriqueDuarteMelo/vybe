import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useLibraryStore } from "../stores/libraryStore";
import { AppLayout } from "../components/layout/AppLayout";
import { HomePage } from "../pages/HomePage";
import { SearchPage } from "../pages/SearchPage";
import { LibraryPage } from "../pages/LibraryPage";
import { PlaylistPage } from "../pages/PlaylistPage";
import { LikedSongsPage } from "../pages/LikedSongsPage";
import { ArtistPage } from "../pages/ArtistPage";
import { AlbumPage } from "../pages/AlbumPage";
import { HistoryPage } from "../pages/HistoryPage";
import { UploadPage } from "../pages/UploadPage";
import { DeezerArtistPage } from "../pages/DeezerArtistPage";
import { DeezerAlbumPage } from "../pages/DeezerAlbumPage";
import { FreeMusicPage } from "../pages/FreeMusicPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { NotFoundPage } from "../pages/NotFoundPage";

const TITLE_BY_PATH: Record<string, string> = {
  "/": "VYBE - Music that moves you",
  "/search": "Search",
  "/library": "Library",
  "/liked": "Liked Songs",
  "/history": "History",
  "/upload": "Upload",
  "/free": "Free Music",
  "/login": "Sign In",
  "/register": "Sign Up",
};

const TITLE_BY_PREFIX: [string, string][] = [
  ["/playlist/", "Playlist"],
  ["/artist/", "Artist"],
  ["/album/", "Album"],
  ["/deezer/", "Discover"],
];

function titleFor(path: string): string {
  const exact = TITLE_BY_PATH[path];
  if (exact) return exact === "/" ? exact : `${exact} · VYBE`;
  for (const [prefix, label] of TITLE_BY_PREFIX) {
    if (path.startsWith(prefix)) return `${label} · VYBE`;
  }
  return `Page Not Found · VYBE`;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-vybe-500/30 border-t-vybe-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const loadUser = useAuthStore((state) => state.loadUser);
  const loadPlaylists = useLibraryStore((state) => state.loadPlaylists);
  const location = useLocation();

  useEffect(() => {
    loadUser().then(() => {
      const token = localStorage.getItem("vybe_token");
      if (token) loadPlaylists();
    });
  }, [loadUser, loadPlaylists]);

  useEffect(() => {
    document.title = titleFor(location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/playlist/:id" element={<PlaylistPage />} />
        <Route path="/liked" element={<LikedSongsPage />} />
        <Route path="/artist/:id" element={<ArtistPage />} />
        <Route path="/album/:id" element={<AlbumPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/free" element={<FreeMusicPage />} />
        <Route path="/deezer/artist/:id" element={<DeezerArtistPage />} />
        <Route path="/deezer/album/:id" element={<DeezerAlbumPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}