import { prisma } from '../prisma';

/**
 * Case-insensitive: "OtakuFan" and "otakufan" are one name. User.username's
 * unique index is case-sensitive, so this check is what actually prevents
 * look-alike names; register re-runs it right before creating the account.
 */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const existing = await prisma.user.findFirst({
    where: { username: { equals: username.trim(), mode: 'insensitive' } },
    select: { id: true },
  });
  return existing !== null;
}

export async function findUserIdByPhone(phone: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  return user?.id ?? null;
}

/**
 * "Forgot password / username" by username (2026-11-03): the account's own
 * stored number, so the code goes to the number on file. The caller only
 * ever sees it masked. Case-insensitive like every username lookup.
 */
export async function findAccountByUsername(username: string): Promise<{ id: string; username: string; phone: string | null } | null> {
  const name = username.trim();
  if (!name) return null;
  return prisma.user.findFirst({
    where: { username: { equals: name, mode: 'insensitive' } },
    select: { id: true, username: true, phone: true },
  });
}
