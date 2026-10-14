interface RemoteTrack {
  id: string;
  title: string;
  duration: number;
  audioUrl: string;
  trackNumber: null;
  albumId: string;
  artistId: string;
  artist: { id: string; name: string; imageUrl: null; bio: null };
  album: { id: string; title: string; coverUrl: null; releaseYear: null; artistId: string };
  genres: { id: string; name: string }[];
}

const CATALOG: Omit<RemoteTrack, "artist" | "album" | "genres">[] = [
  { id: "remote:sh-1", title: "SoundHelix Song 1", duration: 369, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", trackNumber: null, albumId: "remote:soundhelix", artistId: "remote:thomas" },
  { id: "remote:sh-2", title: "SoundHelix Song 2", duration: 376, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", trackNumber: null, albumId: "remote:soundhelix", artistId: "remote:thomas" },
  { id: "remote:sh-3", title: "SoundHelix Song 3", duration: 371, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", trackNumber: null, albumId: "remote:soundhelix", artistId: "remote:thomas" },
  { id: "remote:sh-4", title: "SoundHelix Song 4", duration: 366, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", trackNumber: null, albumId: "remote:soundhelix", artistId: "remote:thomas" },
  { id: "remote:sh-5", title: "SoundHelix Song 5", duration: 372, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", trackNumber: null, albumId: "remote:soundhelix", artistId: "remote:thomas" },
  { id: "remote:sh-6", title: "SoundHelix Song 6", duration: 390, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", trackNumber: null, albumId: "remote:soundhelix", artistId: "remote:thomas" },
];

const ALBUM = { id: "remote:soundhelix", title: "SoundHelix Sample Tracks", coverUrl: null, releaseYear: null, artistId: "remote:thomas" };
const ARTIST = { id: "remote:thomas", name: "Thomas Schürger", imageUrl: null, bio: null };
const GENRE = { id: "remote:electronic", name: "Electronic" };

function buildTrack(entry: (typeof CATALOG)[number]): RemoteTrack {
  return { ...entry, artist: ARTIST, album: ALBUM, genres: [GENRE] };
}

export function getRemoteCatalog(): RemoteTrack[] {
  return CATALOG.map(buildTrack);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function searchRemote(term: string): RemoteTrack[] {
  const t = normalize(term);
  if (t.length < 3) return [];
  return CATALOG.filter(
    (c) =>
      normalize(c.title).includes(t) ||
      normalize(ARTIST.name).includes(t) ||
      normalize(ALBUM.title).includes(t) ||
      normalize(GENRE.name).includes(t),
  ).map(buildTrack);
}
