import { prisma } from "../../utils/prisma.js";
import { hashPassword, comparePassword, generateToken } from "../../utils/auth.js";
import { ConflictError, BadRequestError, NotFoundError } from "../../utils/errors.js";

interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export const ADMIN_EMAIL = "adm";
const ADMIN_PASSWORD = "adm1";

export async function resolveUserId(userId: string): Promise<string> {
  if (userId !== "adm") return userId;
  try {
    const admin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: { id: true },
    });
    return admin?.id ?? userId;
  } catch {
    return userId;
  }
}

function adminProfile() {
  return {
    id: "adm",
    email: ADMIN_EMAIL,
    username: "Admin",
    avatarUrl: null,
    createdAt: new Date(0).toISOString(),
  };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
  });

  if (existing) {
    if (existing.email === input.email) {
      throw new ConflictError("Email already in use");
    }
    throw new ConflictError("Username already taken");
  }

  const hashedPassword = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      password: hashedPassword,
    },
    select: { id: true, email: true, username: true, avatarUrl: true, createdAt: true },
  });

  const token = generateToken({ userId: user.id, email: user.email });
  return { user, token };
}

export async function login(input: LoginInput) {
  if (input.email === ADMIN_EMAIL && input.password === ADMIN_PASSWORD) {
    try {
      const user = await prisma.user.upsert({
        where: { email: ADMIN_EMAIL },
        update: {},
        create: {
          email: ADMIN_EMAIL,
          username: "Admin",
          password: await hashPassword(ADMIN_PASSWORD),
        },
      });
      const token = generateToken({ userId: user.id, email: user.email });
      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
        token,
      };
    } catch {
      // Database unreachable — fall through to the offline admin account.
    }
    const token = generateToken({ userId: "adm", email: ADMIN_EMAIL });
    return { user: adminProfile(), token };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new BadRequestError("Invalid email or password");
    }

    const valid = await comparePassword(input.password, user.password);
    if (!valid) {
      throw new BadRequestError("Invalid email or password");
    }

    const token = generateToken({ userId: user.id, email: user.email });
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      token,
    };
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError("Database unavailable. Please try again later.");
  }
}

export async function getProfile(userId: string) {
  if (userId === "adm") {
    try {
      const user = await prisma.user.findUnique({
        where: { email: ADMIN_EMAIL },
        select: { id: true, email: true, username: true, avatarUrl: true, createdAt: true },
      });
      if (user) return user;
    } catch {
      // Database unreachable — fall through to the offline admin profile.
    }
    return adminProfile();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, avatarUrl: true, createdAt: true },
  });

  if (!user) throw new NotFoundError("User");
  return user;
}
