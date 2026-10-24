/**
 * OTAKUVA Real-Time & Direct/Group Messaging Domain Service
 * PostgreSQL is the permanent canonical source of truth.
 * All operations enforce authentication, authorization, and participant validation.
 */

import { prisma } from '../prisma';
import { resolveGifForAttachment } from '../media/gifProvider';
import type { NextApiResponseServerIo } from '../../types/socket';

export interface SendMessageInput {
  content: string;
  messageType?: 'TEXT' | 'IMAGE' | 'GIF' | 'MEME' | 'SYSTEM';
  mediaUrl?: string;
  /** Client-chosen GIPHY id; resolved to a provider-verified URL here, never trusted from the client directly. */
  gifId?: string;
  replyToId?: string;
}

/**
 * Pushes a persisted message out over the existing Socket.IO server so open
 * ChatThreads update live. The socket server only exists once something has
 * hit /api/socket/io at least once (see SocketContext); until then this is a
 * harmless no-op and clients still get the message on next fetch.
 */
function emitNewMessage(conversationId: string, message: unknown) {
  const io = (global as any).socketio as NextApiResponseServerIo['socket']['server']['io'] | undefined;
  io?.to(`conversation:${conversationId}`).emit('new_message', message);
}

export interface ConversationSummary {
  id: string;
  type: string;
  title: string | null;
  avatarUrl: string | null;
  updatedAt: Date;
  unreadCount: number;
  animeId?: string | null;
  animeSlug?: string | null;
  lastMessage: {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    messageType: string;
    createdAt: Date;
  } | null;
  participants: {
    id: string;
    username: string;
    avatarUrl: string | null;
    role: string;
  }[];
}

/**
 * Gets an existing 1-on-1 direct conversation between two users or creates a new one
 */
export async function getOrCreateDirectConversation(
  userId1: string,
  userId2: string
): Promise<{ id: string; isNew: boolean }> {
  if (userId1 === userId2) {
    throw new Error('Cannot create a direct conversation with yourself.');
  }

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId2 },
    select: { id: true, username: true },
  });

  if (!targetUser) {
    throw new Error('Target user not found.');
  }

  // Look for an existing DIRECT conversation containing both users
  const existingParticipant = await prisma.conversationParticipant.findFirst({
    where: {
      userId: userId1,
      conversation: {
        type: 'DIRECT',
        participants: {
          some: { userId: userId2 },
        },
      },
    },
    select: { conversationId: true },
  });

  if (existingParticipant) {
    return { id: existingParticipant.conversationId, isNew: false };
  }

  // Create new direct conversation inside a transaction
  const newConversation = await prisma.$transaction(async (tx) => {
    const conv = await tx.conversation.create({
      data: {
        type: 'DIRECT',
        createdById: userId1,
        participants: {
          create: [
            { userId: userId1, role: 'ADMIN' },
            { userId: userId2, role: 'MEMBER' },
          ],
        },
      },
      select: { id: true },
    });

    return conv;
  });

  return { id: newConversation.id, isNew: true };
}

/**
 * Gets the persistent live chat room conversation for an anime, creating it
 * on first visit. Anyone who opens a room is auto-joined as a participant
 * (rooms are public, not invite-based) so it shows up in their ChatList with
 * normal unread tracking — no separate membership model needed.
 */
export async function getOrCreateAnimeRoomConversation(
  userId: string,
  animeId: string
): Promise<{ id: string; animeTitle: string; animePosterUrl: string | null }> {
  const anime = await prisma.anime.findUnique({
    where: { id: animeId },
    select: { id: true, canonicalTitle: true, posterUrl: true },
  });
  if (!anime) {
    throw new Error('Anime not found.');
  }

  let conversation = await prisma.conversation.findUnique({
    where: { animeId },
    select: { id: true },
  });

  if (!conversation) {
    // Two requests racing to create the same room's first visit both hit this
    // branch; the unique index on animeId makes the loser's insert fail
    // cleanly rather than creating a duplicate room.
    try {
      conversation = await prisma.conversation.create({
        data: {
          type: 'ANIME_ROOM',
          animeId,
          createdById: userId,
          participants: { create: [{ userId, role: 'MEMBER' }] },
        },
        select: { id: true },
      });
    } catch {
      conversation = await prisma.conversation.findUniqueOrThrow({
        where: { animeId },
        select: { id: true },
      });
    }
  }

  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId: conversation.id, userId } },
    update: {},
    create: { conversationId: conversation.id, userId, role: 'MEMBER' },
  });

  return { id: conversation.id, animeTitle: anime.canonicalTitle, animePosterUrl: anime.posterUrl };
}

/**
 * Creates a new group conversation with multiple members
 */
export async function createGroupConversation(
  creatorId: string,
  title: string,
  participantUserIds: string[],
  avatarUrl?: string
) {
  if (!title.trim()) {
    throw new Error('Group conversation title is required.');
  }

  const uniqueIds = Array.from(new Set([creatorId, ...participantUserIds]));
  if (uniqueIds.length < 2) {
    throw new Error('Group conversation requires at least 2 participants.');
  }

  const conversation = await prisma.$transaction(async (tx) => {
    return tx.conversation.create({
      data: {
        type: 'GROUP',
        title: title.trim(),
        avatarUrl: avatarUrl || null,
        createdById: creatorId,
        participants: {
          create: uniqueIds.map((uId) => ({
            userId: uId,
            role: uId === creatorId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true },
            },
          },
        },
      },
    });
  });

  return conversation;
}

/**
 * Returns all conversations the user is a participant in, sorted by latest message activity
 */
export async function getUserConversations(userId: string): Promise<ConversationSummary[]> {
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          anime: {
            select: { id: true, slug: true, canonicalTitle: true, posterUrl: true },
          },
          participants: {
            include: {
              user: {
                select: { id: true, username: true, avatarUrl: true },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            where: { deletedAt: null },
            include: {
              sender: {
                select: { id: true, username: true },
              },
            },
          },
        },
      },
    },
    orderBy: {
      conversation: { updatedAt: 'desc' },
    },
  });

  return memberships.map((m) => {
    const conv = m.conversation;
    const lastMsg = conv.messages[0] || null;

    // Count unread messages (messages created after lastReadAt, not sent by this user)
    const lastRead = m.lastReadAt || new Date(0);

    // Format title for direct conversations: use the other participant's username
    let displayTitle = conv.title;
    let displayAvatar = conv.avatarUrl;

    if (conv.type === 'DIRECT') {
      const other = conv.participants.find((p) => p.userId !== userId);
      if (other) {
        displayTitle = other.user.username;
        displayAvatar = other.user.avatarUrl;
      }
    } else if (conv.type === 'ANIME_ROOM' && conv.anime) {
      displayTitle = conv.anime.canonicalTitle;
      displayAvatar = conv.anime.posterUrl;
    }

    return {
      id: conv.id,
      type: conv.type,
      title: displayTitle,
      avatarUrl: displayAvatar,
      updatedAt: conv.updatedAt,
      unreadCount: lastMsg && new Date(lastMsg.createdAt) > lastRead && lastMsg.senderId !== userId ? 1 : 0,
      animeId: conv.anime?.id ?? null,
      animeSlug: conv.anime?.slug ?? null,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            senderId: lastMsg.senderId,
            senderName: lastMsg.sender.username,
            content: lastMsg.content,
            messageType: lastMsg.messageType,
            createdAt: lastMsg.createdAt,
          }
        : null,
      participants: conv.participants.map((p) => ({
        id: p.user.id,
        username: p.user.username,
        avatarUrl: p.user.avatarUrl,
        role: p.role,
      })),
    };
  });
}

/**
 * Returns messages for a conversation with authorization check
 */
export async function getConversationMessages(
  userId: string,
  conversationId: string,
  limit = 50,
  before?: string
) {
  // Authorization check
  const membership = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });

  if (!membership) {
    throw new Error('Unauthorized: You are not a participant in this conversation.');
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
    include: {
      sender: {
        select: { id: true, username: true, avatarUrl: true, role: true },
      },
      reactions: {
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
      },
    },
  });

  // Group reactions by emoji
  const formattedMessages = messages.map((msg) => {
    const reactionMap: Record<string, { count: number; users: string[]; hasReacted: boolean }> = {};
    msg.reactions.forEach((r) => {
      if (!reactionMap[r.emoji]) {
        reactionMap[r.emoji] = { count: 0, users: [], hasReacted: false };
      }
      reactionMap[r.emoji].count++;
      reactionMap[r.emoji].users.push(r.user.username);
      if (r.userId === userId) {
        reactionMap[r.emoji].hasReacted = true;
      }
    });

    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      sender: msg.sender,
      content: msg.content,
      messageType: msg.messageType,
      mediaUrl: msg.mediaUrl,
      replyToId: msg.replyToId,
      createdAt: msg.createdAt,
      reactions: reactionMap,
    };
  });

  return formattedMessages;
}

/**
 * Persists a new message in PostgreSQL after verifying identity and participant authorization
 */
export async function sendMessage(
  userId: string,
  conversationId: string,
  input: SendMessageInput
) {
  const content = input.content.trim();

  // A GIF id is always resolved here, server-side, against the provider —
  // the client only ever supplies a chosen id, never a URL, so nothing
  // reaches the DB that GIPHY didn't actually vouch for.
  let mediaUrl = input.mediaUrl || null;
  let messageType = input.messageType || 'TEXT';
  if (input.gifId) {
    const gif = await resolveGifForAttachment(input.gifId);
    mediaUrl = gif.url;
    messageType = 'GIF';
  }

  if (!content && !mediaUrl) {
    throw new Error('Message content or media is required.');
  }

  // Authorization check: derive sender identity strictly from server-authenticated session
  const membership = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });

  if (!membership) {
    throw new Error('Unauthorized: You are not a participant in this conversation.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: content || '',
        messageType,
        mediaUrl,
        replyToId: input.replyToId || null,
      },
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true, role: true },
        },
      },
    });

    // Update conversation last activity timestamp
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Update sender's last read timestamp
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    return msg;
  });

  const formatted = { ...result, reactions: {} as Record<string, { count: number; users: string[]; hasReacted: boolean }> };
  emitNewMessage(conversationId, formatted);
  return formatted;
}

/**
 * Adds or updates an emoji reaction to a message
 */
export async function toggleMessageReaction(
  userId: string,
  messageId: string,
  emoji: string
) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });

  if (!message) {
    throw new Error('Message not found.');
  }

  // Verify participant
  const membership = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: message.conversationId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new Error('Unauthorized.');
  }

  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId,
        emoji,
      },
    },
  });

  if (existing) {
    await prisma.messageReaction.delete({
      where: { id: existing.id },
    });
    return { action: 'REMOVED', emoji };
  } else {
    await prisma.messageReaction.create({
      data: {
        messageId,
        userId,
        emoji,
      },
    });
    return { action: 'ADDED', emoji };
  }
}

/**
 * Updates last read timestamp for a participant in a conversation
 */
export async function markConversationAsRead(userId: string, conversationId: string) {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: new Date() },
  });
  return { success: true };
}
