/**
 * Who may set which community access settings (Creator Mode, 2026-10-24).
 * The server decides — visibility, join policy and type are never taken
 * from the client as-is (they used to be, unvalidated).
 *
 *   PUBLIC           anyone can find it and join      joinPolicy OPEN
 *   REQUEST_TO_JOIN  anyone can find it, owner approves  APPROVAL_REQUIRED
 *   PRIVATE          members-only: joining needs an invitation link + key
 *                    (src/lib/community/invitations.ts)   INVITE_ONLY
 *
 * PRIVATE and the creator community types need the CREATOR role (or ADMIN).
 * Only the owner may change visibility (community admins can't).
 */
import { isCreator } from '../roles';

export const VISIBILITIES = ['PUBLIC', 'REQUEST_TO_JOIN', 'PRIVATE'] as const;
export type CommunityVisibility = (typeof VISIBILITIES)[number];

const OPEN_TYPES = ['ANIME', 'SEASON', 'GENRE', 'STUDIO', 'GENERAL'];
const CREATOR_TYPES = ['CREATOR', 'CREATOR_EXCLUSIVE'];

export const JOIN_POLICY_FOR: Record<CommunityVisibility, string> = {
  PUBLIC: 'OPEN',
  REQUEST_TO_JOIN: 'APPROVAL_REQUIRED',
  PRIVATE: 'INVITE_ONLY',
};

/**
 * Members-only: only reachable through an invitation. A PRIVATE community is
 * invite-only unless its owner chose approval-based joining (a request grants
 * nothing until the owner approves, so it stays private). PRIVATE with any
 * other policy — e.g. OPEN, which used to let anyone who knew the slug walk
 * in — is invite-only.
 */
export function isInviteOnly(c: { visibility: string; joinPolicy?: string | null; communityType?: string | null }): boolean {
  if (c.joinPolicy === 'INVITE_ONLY' || c.joinPolicy === 'CREATOR_ONLY' || c.communityType === 'CREATOR_EXCLUSIVE') return true;
  return c.visibility === 'PRIVATE' && c.joinPolicy !== 'APPROVAL_REQUIRED';
}

export function parseVisibility(raw: unknown): CommunityVisibility {
  const v = typeof raw === 'string' ? raw.trim().toUpperCase() : 'PUBLIC';
  if (!(VISIBILITIES as readonly string[]).includes(v)) {
    throw new Error('Validation: visibility must be PUBLIC, REQUEST_TO_JOIN or PRIVATE');
  }
  return v as CommunityVisibility;
}

/** Visibility + join policy + type for a new community, checked against the creator's role. */
export function resolveNewCommunityAccess(
  input: { visibility?: unknown; communityType?: unknown },
  role: string
): { visibility: CommunityVisibility; joinPolicy: string; communityType: string } {
  const visibility = parseVisibility(input.visibility ?? 'PUBLIC');
  const creator = isCreator(role);
  if (visibility === 'PRIVATE' && !creator) {
    throw new Error('Forbidden: only creator accounts can create members-only communities');
  }
  const rawType = typeof input.communityType === 'string' ? input.communityType.trim().toUpperCase() : 'GENERAL';
  let communityType = OPEN_TYPES.includes(rawType) ? rawType : 'GENERAL';
  if (CREATOR_TYPES.includes(rawType)) {
    if (!creator) throw new Error('Forbidden: only creator accounts can create creator communities');
    communityType = rawType;
  }
  if (visibility === 'PRIVATE') communityType = 'CREATOR_EXCLUSIVE';
  else if (communityType === 'CREATOR_EXCLUSIVE') communityType = 'CREATOR';
  return { visibility, joinPolicy: JOIN_POLICY_FOR[visibility], communityType };
}

/** A visibility change on an existing community. */
export function resolveVisibilityChange(
  next: unknown,
  actor: { userId: string; role: string },
  community: { ownerId: string; visibility: string }
): { visibility: CommunityVisibility; joinPolicy: string; communityType?: string } | null {
  const visibility = parseVisibility(next);
  if (visibility === community.visibility) return null;
  if (actor.userId !== community.ownerId) {
    throw new Error('Unauthorized: only the community owner can change who can join');
  }
  if (visibility === 'PRIVATE' && !isCreator(actor.role)) {
    throw new Error('Unauthorized: only creator accounts can make a community members-only');
  }
  return {
    visibility,
    joinPolicy: JOIN_POLICY_FOR[visibility],
    ...(visibility === 'PRIVATE' ? { communityType: 'CREATOR_EXCLUSIVE' } : community.visibility === 'PRIVATE' ? { communityType: 'CREATOR' } : {}),
  };
}
