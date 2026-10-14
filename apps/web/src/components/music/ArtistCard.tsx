import type { Artist } from "@vybe/shared";
import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ArtistCardProps {
  artist: Artist;
  href?: string;
}

export function ArtistCard({ artist, href }: ArtistCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(href ?? `/artist/${artist.id}`)}
      className="group text-left bg-surface-50 rounded-xl border border-white/5 p-4 overflow-hidden hover-lift"
    >
      <div className="relative aspect-square rounded-full bg-gradient-to-br from-vybe-500/30 to-surface-300 flex items-center justify-center mb-3 overflow-hidden">
        <span className="text-4xl font-bold text-vybe-500/40">{artist.name[0]}</span>
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="w-12 h-12 rounded-full bg-vybe-600 flex items-center justify-center glow-vybe">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </span>
        </span>
      </div>
      <p className="text-sm font-medium text-white truncate text-center">{artist.name}</p>
      <p className="text-xs text-gray-400 truncate text-center">
        {artist._count?.tracks ? `${artist._count.tracks} tracks` : ""}
        {artist._count?.albums ? ` · ${artist._count.albums} albums` : ""}
      </p>
    </button>
  );
}