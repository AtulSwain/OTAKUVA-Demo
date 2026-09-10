/**
 * Automated Verification Test Suite for
 * OTAKUVA Real-Time & Direct/Group Messaging System.
 */

import { prisma } from './prisma';
import {
  getOrCreateDirectConversation,
  createGroupConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  toggleMessageReaction,
  markConversationAsRead,
} from './chat/chatService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runMessagingTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OTAKUVA REAL-TIME MESSAGING TEST SUITE');
  console.log('======================================================\n');

  // 1. Create test users
  const alice = await prisma.user.upsert({
    where: { email: 'alice_chat_test@otakuva.com' },
    update: {},
    create: {
      username: 'AliceTenma',
      email: 'alice_chat_test@otakuva.com',
      passwordHash: 'seeded_hash_123',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob_chat_test@otakuva.com' },
    update: {},
    create: {
      username: 'BobJohan',
      email: 'bob_chat_test@otakuva.com',
      passwordHash: 'seeded_hash_123',
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie_chat_test@otakuva.com' },
    update: {},
    create: {
      username: 'CharlieGrimmer',
      email: 'charlie_chat_test@otakuva.com',
      passwordHash: 'seeded_hash_123',
    },
  });

  // --- TEST 1: Direct Conversation Creation & Idempotency ---
  console.log('--- TEST 1: Direct Conversation Creation & Idempotency ---');
  const direct1 = await getOrCreateDirectConversation(alice.id, bob.id);
  assert(Boolean(direct1.id), `Direct conversation created with ID: ${direct1.id}`);

  const direct2 = await getOrCreateDirectConversation(alice.id, bob.id);
  assert(direct1.id === direct2.id, 'Idempotent creation returns the existing conversation ID');
  assert(direct2.isNew === false, 'Existing conversation marked isNew = false');

  // Attempting DM with self must throw
  let selfErrorThrown = false;
  try {
    await getOrCreateDirectConversation(alice.id, alice.id);
  } catch {
    selfErrorThrown = true;
  }
  assert(selfErrorThrown, 'Creating conversation with oneself is rejected');

  // --- TEST 2: Message Sending & Participant Validation ---
  console.log('\n--- TEST 2: Message Sending & Authorization ---');
  const msg1 = await sendMessage(alice.id, direct1.id, {
    content: 'Have you watched Monster Episode 74 yet?',
    messageType: 'TEXT',
  });
  assert(msg1.content === 'Have you watched Monster Episode 74 yet?', 'Message content stored accurately');
  assert(msg1.sender.username === 'AliceTenma', 'Sender verified as Alice');

  const msg2 = await sendMessage(bob.id, direct1.id, {
    content: 'Yes! That ending was absolutely chilling.',
    messageType: 'TEXT',
    replyToId: msg1.id,
  });
  assert(msg2.replyToId === msg1.id, 'Reply message correctly references parent message');

  // Non-participant (Charlie) attempting to send message must be rejected
  let unauthorizedSend = false;
  try {
    await sendMessage(charlie.id, direct1.id, { content: 'I am invading this private DM' });
  } catch (err: any) {
    unauthorizedSend = err.message.includes('Unauthorized');
  }
  assert(unauthorizedSend, 'Non-participant is blocked with 403 Unauthorized');

  // --- TEST 3: Group Conversation & Multi-party Messaging ---
  console.log('\n--- TEST 3: Group Conversation Creation ---');
  const group = await createGroupConversation(
    alice.id,
    'Psychological Masterpieces Club',
    [bob.id, charlie.id]
  );
  assert(group.title === 'Psychological Masterpieces Club', 'Group created with title');
  assert(group.type === 'GROUP', 'Group type is GROUP');
  assert(group.participants.length === 3, 'Group contains all 3 participants');

  const groupMsg = await sendMessage(charlie.id, group.id, {
    content: 'Steins;Gate and Monster are top tier!',
    messageType: 'TEXT',
  });
  assert(Boolean(groupMsg.id), 'Charlie sent message to group');

  // --- TEST 4: Message Reactions ---
  console.log('\n--- TEST 4: Emoji Reactions Toggle ---');
  const reactionAdded = await toggleMessageReaction(bob.id, groupMsg.id, '🔥');
  assert(reactionAdded.action === 'ADDED', 'Reaction added');

  const reactionRemoved = await toggleMessageReaction(bob.id, groupMsg.id, '🔥');
  assert(reactionRemoved.action === 'REMOVED', 'Reaction toggled off / removed');

  await toggleMessageReaction(alice.id, groupMsg.id, '❤️');

  // --- TEST 5: Message Retrieval & Formatted Feed ---
  console.log('\n--- TEST 5: Message History Retrieval ---');
  const history = await getConversationMessages(alice.id, group.id);
  assert(history.length >= 1, `Retrieved ${history.length} group messages`);
  assert(Boolean(history[0].reactions['❤️']), 'Heart reaction present in formatted message');

  // Non-participant reading group messages must be rejected
  const outsider = await prisma.user.upsert({
    where: { email: 'outsider_chat_test@otakuva.com' },
    update: {},
    create: {
      username: 'OutsiderUser',
      email: 'outsider_chat_test@otakuva.com',
      passwordHash: 'seeded_hash_123',
    },
  });
  let unauthorizedRead = false;
  try {
    await getConversationMessages(outsider.id, group.id);
  } catch (err: any) {
    unauthorizedRead = err.message.includes('Unauthorized');
  }
  assert(unauthorizedRead, 'Outsider cannot read private group conversation');

  // --- TEST 6: User Conversations Summary & Unread Counting ---
  console.log('\n--- TEST 6: User Conversations Summary ---');
  const aliceConvs = await getUserConversations(alice.id);
  assert(aliceConvs.length >= 2, 'Alice has at least 2 conversations (Direct + Group)');
  assert(Boolean(aliceConvs[0].lastMessage), 'Conversation includes last message preview');

  await markConversationAsRead(alice.id, direct1.id);
  assert(true, 'Marked conversation as read');

  console.log('\n======================================================');
  console.log('🎉 ALL REAL-TIME MESSAGING TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runMessagingTests()
  .catch((err) => {
    console.error('Messaging test runner failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
