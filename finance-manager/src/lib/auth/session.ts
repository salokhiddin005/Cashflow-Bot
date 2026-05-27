import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSession,
  createWorkspace,
  deleteSession,
  findUserById,
  getSession,
  getWorkspaceByUserId,
} from "../db/auth-queries";
import { newToken } from "./tokens";
import type { User, Workspace } from "../db/types";

const COOKIE_NAME = "cf_session";
const SESSION_DAYS = 30;

function expiryDate(): Date {
  return new Date(Date.now() + SESSION_DAYS * 86_400_000);
}

// Issue a session for `userId` and write the cookie. Called on signup, login,
// and right after a successful claim.
export async function startSession(userId: number): Promise<void> {
  const token = newToken();
  const exp = expiryDate();
  await createSession(token, userId, exp.toISOString());
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: exp,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await deleteSession(token).catch(() => {});
    jar.delete(COOKIE_NAME);
  }
}

// Returns the signed-in user, or null. Reads from the session cookie. Safe
// to call from server components, server actions, and API routes.
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  if (Date.parse(session.expires_at) < Date.now()) {
    await deleteSession(token).catch(() => {});
    return null;
  }
  const user = await findUserById(session.user_id);
  return user ?? null;
}

// Use in pages that require auth. Redirects to /login if no session.
export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

// Returns the signed-in user's workspace. Auto-creates one if the user
// somehow doesn't have one yet (shouldn't happen — signup always provisions
// one — but cheap insurance).
export async function requireUserWorkspace(): Promise<{ user: User; workspace: Workspace }> {
  const user = await requireUser();
  let workspace = await getWorkspaceByUserId(user.id);
  if (!workspace) workspace = await createWorkspace(user.id);
  return { user, workspace };
}

export async function getCurrentUserAndWorkspace(): Promise<{ user: User; workspace: Workspace } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  let workspace = await getWorkspaceByUserId(user.id);
  if (!workspace) workspace = await createWorkspace(user.id);
  return { user, workspace };
}
