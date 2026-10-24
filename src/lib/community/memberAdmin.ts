/**
 * Removing a member — the explicit action that revoking an invitation is not
 * (Creator Mode, 2026-10-24). The owner or a community admin may remove a
 * member; nobody can remove the owner, and admins can't remove other admins.
 * Removal sets the membership to LEFT (history kept); rejoining a
 * members-only community then needs a valid invitation again.
 */
import { prisma } from '../prisma';
import { getMemberPermission } from '../engine/community/communityEngine';
import { InviteError } from './invitations';

export async function removeCommunityMember(actorId: string, communityIdOrSlug: string, targetUserId: string) {
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: communityIdOrSlug }, { slug: communityIdOrSlug }], status: { not: 'DELETED' } },
    select: { id: true, ownerId: true },
  });
  if (!community) throw new InviteError(404, 'COMMUNITY_NOT_FOUND', 'Community not found.');

  const perm = await getMemberPermission(actorId, community.id);
  if (!perm.isAdmin) throw new InviteError(403, 'FORBIDDEN', 'Only the owner or a community admin can remove members.');
  if (targetUserId === community.ownerId) throw new InviteError(400, 'OWNER', "The owner can't be removed.");
  if (targetUserId === actorId) throw new InviteError(400, 'SELF', 'Use Leave to leave a community.');

  const target = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: targetUserId } },
  });
  if (!target || target.status !== 'ACTIVE') throw new InviteError(404, 'NOT_A_MEMBER', 'That person is not a member.');
  if (target.role === 'ADMIN' && !perm.isOwner) throw new InviteError(403, 'FORBIDDEN', 'Only the owner can remove an admin.');

  await prisma.$transaction(async (tx) => {
    await tx.communityMember.update({ where: { id: target.id }, data: { status: 'LEFT' } });
    const members = await tx.communityMember.count({ where: { communityId: community.id, status: 'ACTIVE' } });
    await tx.community.update({ where: { id: community.id }, data: { memberCount: members } });
    await tx.moderationAction.create({
      data: {
        moderatorId: actorId,
        targetUserId,
        communityId: community.id,
        targetType: 'COMMUNITY_MEMBER',
        targetId: targetUserId,
        action: 'REMOVE_MEMBER',
        reason: 'Removed by community owner/admin',
      },
    });
  });
  return { removed: true };
}
