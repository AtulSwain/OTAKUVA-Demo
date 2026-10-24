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
