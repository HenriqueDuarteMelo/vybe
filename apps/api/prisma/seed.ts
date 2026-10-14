import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateAudioFile } from "./generateAudio";
import { resolve } from "path";

const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? resolve(process.env.UPLOAD_DIR)
  : resolve(process.cwd(), "uploads");

// Deterministic pseudo-random so re-seeds keep the same feel
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

async function main() {
  console.log("🌱 Seeding database...");

  console.log("🧹 Cleaning existing data...");
  await prisma.listeningHistory.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.playlistTrack.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.track.deleteMany();
  await prisma.album.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.genre.deleteMany();
  await prisma.user.deleteMany();

const devPassword = bcrypt.hashSync("password123", 12);
const adminPassword = bcrypt.hashSync("adm1", 12);

const devUser = await prisma.user.upsert({
  where: { email: "dev@vybe.com" },
  update: {},
  create: {
    email: "dev@vybe.com",
    username: "dev_user",
    password: devPassword,
  },
});
console.log(`✅ User: ${devUser.username}`);

const adminUser = await prisma.user.upsert({
  where: { email: "adm" },
  update: {},
  create: {
    email: "adm",
    username: "Admin",
    password: adminPassword,
  },
});
console.log(`✅ User: ${adminUser.username}`);

  const genreNames = [
    "Rock", "Pop", "Electronic", "Jazz", "Classical",
    "Hip Hop", "R&B", "Indie", "Folk", "Metal",
    "MPB", "Samba", "Bossa Nova", "Sertanejo", "Funk", "Reggae",
  ];

  const genres = await Promise.all(
    genreNames.map((name) => prisma.genre.upsert({ where: { name }, update: {}, create: { name } }))
  );
  console.log(`✅ Genres: ${genres.length}`);

  const G = (name: string) => genreNames.indexOf(name);

  interface AlbumSeed {
    title: string;
    year: number;
    genre: string;
    tracks: string[];
  }

  interface ArtistSeed {
    name: string;
    bio: string;
    albums: AlbumSeed[];
  }

  const artistsData: ArtistSeed[] = [
    {
      name: "The Neon Waves",
      bio: "Synth-pop pioneers from Berlin with neon-lit melodies and driving basslines.",
      albums: [
        {
          title: "Neon Dreams", year: 2024, genre: "Pop",
          tracks: ["Electric Sunset", "City Lights", "Midnight Signal", "Chrome Hearts", "Glass Dancefloor", "Stereo Love"],
        },
        {
          title: "Pulse", year: 2023, genre: "Electronic",
          tracks: ["Pulse Point", "Neon Skies", "Retrowave", "Strobe Effect", "Edge of Dawn", "Hypercolor"],
        },
      ],
    },
    {
      name: "Luna Solaris",
      bio: "Dreamy indie rock from Portland — hazy guitars, whispered vocals, big choruses.",
      albums: [
        {
          title: "Stellar", year: 2023, genre: "Indie",
          tracks: ["Falling Stars", "Moonlit Avenue", "Paper Satellites", "Hollow Light", "Constellations", "Silver Clouds"],
        },
        {
          title: "Tidal", year: 2024, genre: "Indie",
          tracks: ["Undercurrent", "Salt & Static", "Ebb Away", "Rip Current", "Anchorless", "Driftwood"],
        },
      ],
    },
    {
      name: "Midnight Circuit",
      bio: "Tokyo-born electronic producer mixing IDM, techno and film-score ambience.",
      albums: [
        {
          title: "Digital Horizon", year: 2024, genre: "Electronic",
          tracks: ["Circuit Breaker", "Tokyo Midnight", "Hard Reset", "Analog Dreams", "Voltage", "Static Bloom"],
        },
      ],
    },
    {
      name: "Velvet Echo",
      bio: "Alternative rock band from London — brooding, swaggering, arena-sized.",
      albums: [
        {
          title: "Shattered Glass", year: 2023, genre: "Rock",
          tracks: ["Shadow Dance", "Breaking Free", "Broken Mirrors", "Brutal Truth", "Silhouette", "Rolling Thunder"],
        },
      ],
    },
    {
      name: "Cosmic Drift",
      bio: "Ambient electronica from Reykjavik, built from field recordings and slow chords.",
      albums: [
        {
          title: "Aurora", year: 2024, genre: "Electronic",
          tracks: ["Northern Lights", "Glacier", "Aurora Borealis", "Ice Fields", "Polar Silence", "Nightfall"],
        },
      ],
    },
    {
      name: "Jade Phoenix",
      bio: "Neo-soul songstress from Atlanta with honeyed vocals and church-trained harmonies.",
      albums: [
        {
          title: "Moonlit", year: 2023, genre: "R&B",
          tracks: ["Golden Hour", "Velvet", "Slow Burn", "Moonlight Serenade", "Midnight Conversations", "Satin"],
        },
        {
          title: "Rise", year: 2024, genre: "R&B",
          tracks: ["Phoenix Rising", "Redemption", "Wings of Gold", "Broken Halo", "Higher Ground", "Embers"],
        },
      ],
    },
    {
      name: "Iron Cascade",
      bio: "Progressive metal quintet from São Paulo — riffs, odd time signatures and Portuguese lyrics.",
      albums: [
        {
          title: "Forged in Fire", year: 2024, genre: "Metal",
          tracks: ["Forged in Fire", "Steel Rivers", "Thunder of Chains", "Abyss", "Iron Will", "Cataratas"],
        },
      ],
    },
    {
      name: "Paper Towns",
      bio: "Indie folk duo from Melbourne — two voices, one guitar, stories about small towns.",
      albums: [
        {
          title: "Campfire Stories", year: 2023, genre: "Folk",
          tracks: ["Campfire Stories", "Dusty Roads", "Wildflower", "Backroads", "Porch Light", "Homebound"],
        },
      ],
    },
    {
      name: "Zero Gravity",
      bio: "Hip hop collective from New York — boom-bap drums and sharp, bilingual bars.",
      albums: [
        {
          title: "Street Poetry", year: 2024, genre: "Hip Hop",
          tracks: ["Street Poetry", "Concrete Jungle", "Late Night Freestyle", "Open Mic", "Block Party", "Mic Check"],
        },
      ],
    },
    {
      name: "Silver Lining",
      bio: "Pop singer-songwriter from Nashville — hook-first songwriting for late-summer drives.",
      albums: [
        {
          title: "Golden Hour", year: 2023, genre: "Pop",
          tracks: ["Golden Hour", "Better Days", "Wanna Dance", "Sunday Drive", "Fireworks", "Afterglow"],
        },
      ],
    },
    {
      name: "Ana Martins",
      bio: "Cantora e compositora de MPB — voz marcante, guitarras suaves e poesia do cotidiano.",
      albums: [
        {
          title: "Maré Alta", year: 2024, genre: "MPB",
          tracks: ["Maré Alta", "Cidade Interior", "Vento Norte", "Retrato em Preto e Branco", "Lua Cheia", "Caminho de Pedra"],
        },
      ],
    },
    {
      name: "Os Bambas do Rio",
      bio: "Bloco de samba e pagode do Rio de Janeiro — cavaco, pandeiro e o coração carioca.",
      albums: [
        {
          title: "Vem pro Pagode", year: 2023, genre: "Samba",
          tracks: ["Vem Pro Pagode", "Raiz do Morro", "Samba de Primeira", "Roda Viva", "Coração Carioca", "Malandro"],
        },
      ],
    },
    {
      name: "João Bossa Nova",
      bio: "Violonista e cantor de bossa nova — suingue tranquilo de Copacabana.",
      albums: [
        {
          title: "Horizonte Azul", year: 2023, genre: "Bossa Nova",
          tracks: ["Horizonte Azul", "Caminho do Mar", "Garota de Ipanema Blues", "Contradança", "Só Danço Samba", "Esquina"],
        },
      ],
    },
    {
      name: "Caipira Século",
      bio: "Dupla sertaneja raiz — viola caipira, modas de viola e causos do interior de SP.",
      albums: [
        {
          title: "Estrada de Terra", year: 2024, genre: "Sertanejo",
          tracks: ["Estrada de Terra", "Viola e Peão", "Saudade da Roça", "Boiadeiro", "Tropeiro", "Casa na Serra"],
        },
      ],
    },
    {
      name: "Baile do Gueto",
      bio: "Coletivo de funk de São Paulo — batidão, grooves pesados e letras de quebrada.",
      albums: [
        {
          title: "Batidão", year: 2024, genre: "Funk",
          tracks: ["Batidão", "Passinho do Gueto", "Ritmo da Favela", "Mega da Virada", "Trovão", "Gatilho"],
        },
      ],
    },
    {
      name: "Rei da Jamaica",
      bio: "Banda de reggae de Salvador — um som suave com a energia do verão baiano.",
      albums: [
        {
          title: "Sol a Sol", year: 2023, genre: "Reggae",
          tracks: ["Sol a Sol", "Mar Azul", "Roots & Friends", "Fumaça de Erva", "Leveza", "Praia do Farol"],
        },
      ],
    },
  ];

  const artists = [];
  for (const data of artistsData) {
    const artist = await prisma.artist.create({ data: { name: data.name, bio: data.bio } });
    artists.push({ ...artist, seed: data });
  }
  console.log(`✅ Artists: ${artists.length}`);

  const random = seededRandom(42);
  const allTracks: { id: string; title: string; artistId: string }[] = [];

  let albumCount = 0;
  for (const artist of artists) {
    for (const albumSeed of artist.seed.albums) {
      const album = await prisma.album.create({
        data: {
          title: albumSeed.title,
          releaseYear: albumSeed.year,
          artistId: artist.id,
        },
      });
      albumCount++;

      const genre = genres[G(albumSeed.genre)];
      for (let t = 0; t < albumSeed.tracks.length; t++) {
        const title = albumSeed.tracks[t];
        const duration = 165 + Math.floor(random() * 195);
        const track = await prisma.track.create({
          data: {
            title,
            duration,
            trackNumber: t + 1,
            albumId: album.id,
            artistId: artist.id,
          },
        });
        await prisma.track.update({
          where: { id: track.id },
          data: { genres: { connect: { id: genre.id } } },
        });
        allTracks.push({ id: track.id, title: track.title, artistId: artist.id });
      }
    }
  }
  console.log(`✅ Albums: ${albumCount}`);
  console.log(`✅ Tracks: ${allTracks.length}`);

  console.log("🎵 Generating development audio files...");
  for (const track of allTracks) {
    const found = await prisma.track.findUnique({ where: { id: track.id } });
    const fileName = await generateAudioFile(UPLOAD_DIR, track.id, found?.duration ?? 180);
    await prisma.track.update({
      where: { id: track.id },
      data: { audioUrl: fileName },
    });
  }
  console.log(`✅ Audio files: ${allTracks.length}`);

  const playlist = await prisma.playlist.create({
    data: {
      name: "VYBE Essentials",
      description: "The best of VYBE curated tracks across all styles",
      userId: devUser.id,
      isPublic: true,
    },
  });

  const playlistPick = allTracks.filter((_, i) => i % 4 === 0).slice(0, 20);
  for (let i = 0; i < playlistPick.length; i++) {
    await prisma.playlistTrack.create({
      data: { playlistId: playlist.id, trackId: playlistPick[i].id, position: i },
    });
  }
  console.log(`✅ Playlist: ${playlist.name} (${playlistPick.length} tracks)`);

  const favorites = allTracks.filter((_, i) => i % 7 === 0).slice(0, 10);
  for (const fav of favorites) {
    await prisma.favorite.create({ data: { userId: devUser.id, trackId: fav.id } });
  }
  console.log(`✅ Favorites: ${favorites.length}`);

  console.log("\n🎉 Seed completed!");
  console.log(`\n📧 Dev accounts:\n   email: adm\n   password: adm1\n\n   email: dev@vybe.com\n   password: password123`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());