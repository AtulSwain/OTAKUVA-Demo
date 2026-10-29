/**
 * OTAKUVA — create (or reset) the control-center admin account (2026-10-28)
 *
 *   npx tsx scripts/create_control_admin.ts --username=<name>
 *
 * Asks for the password twice (typing is hidden) — it's never passed on the
 * command line, stored in a file or committed. The account gets role
 * SUPER_ADMIN and signs in at /control with that username + password.
 * Re-running for an existing username resets its password and makes sure
 * it is SUPER_ADMIN. Writes an AuditLog entry. No phone number is needed.
 */
import readline from 'node:readline';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';
import { validatePassword } from '../src/lib/identity/password';

const username = (process.argv.find((a) => a.startsWith('--username=')) || '').split('=')[1]?.trim();
if (!username || !/^[A-Za-z0-9_.]{4,32}$/.test(username)) {
  console.error('Usage: npx tsx scripts/create_control_admin.ts --username=<4–32 letters, numbers, _ or .>');
  process.exit(2);
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput?: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    out._writeToOutput = (s: string) => {
      if (!muted) out.output.write(s);
      else if (s.includes('\n') || s.includes('\r')) out.output.write('\n');
      else out.output.write('*');
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  // Non-interactive option (e.g. a deploy step): CONTROL_ADMIN_PASSWORD in the
  // environment for that one command. Never put it in a file.
  const fromEnv = process.env.CONTROL_ADMIN_PASSWORD;
  const password = fromEnv ?? (await askHidden(`Password for ${username}: `));
  const problem = validatePassword(password, username);
  if (problem) throw new Error(problem);
  if (password.length < 12) throw new Error('Use at least 12 characters for the control-center account.');
  if (fromEnv === undefined) {
    const again = await askHidden('Type it again: ');
    if (again !== password) throw new Error("Passwords don't match.");
  }

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } }, select: { id: true, username: true, role: true } });

  let id: string;
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, role: 'SUPER_ADMIN' } });
    id = existing.id;
    console.log(`Updated ${existing.username}: password reset, role SUPER_ADMIN (was ${existing.role}).`);
  } else {
    const created = await prisma.user.create({ data: { username, passwordHash, role: 'SUPER_ADMIN' }, select: { id: true } });
    id = created.id;
    console.log(`Created ${username} (SUPER_ADMIN).`);
  }
  await prisma.$executeRaw`UPDATE "User" SET "passwordChangedAt" = NOW() WHERE id = ${id}`;
  await prisma.auditLog.create({
    data: {
      actorId: id,
      action: 'USER_ROLE_CHANGE',
      entityType: 'User',
      entityId: id,
      beforeJson: JSON.stringify({ role: existing?.role ?? null }),
      afterJson: JSON.stringify({ role: 'SUPER_ADMIN', via: 'scripts/create_control_admin.ts' }),
    },
  });
  console.log('Sign in at /control with this username and password.');
}

main()
  .catch((e) => {
    console.error(`Not saved: ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
