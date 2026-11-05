import { describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../../test/prisma-mock';

const prisma = createPrismaMock();
vi.mock('../../lib/prisma', () => ({ prisma }));
const { notify } = await import('./notify');
const { realtimeBus } = await import('../../lib/realtime-bus');

describe('notify', () => {
  it('nunca notifica quem fez a ação e publica em tempo real', async () => {
    prisma.notification!.create!.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'n1',
        ...data,
        readAt: null,
        createdAt: new Date('2026-01-01'),
        actor: null,
      }),
    );
    const received: string[] = [];
    const off = realtimeBus.onNotification((userId) => received.push(userId));

    await notify([
      { userId: 'a', actorId: 'a', type: 'MENTION', message: 'eu', data: {} },
      { userId: 'b', actorId: 'a', type: 'MENTION', message: 'você', data: { cardId: 'c1' } },
    ]);
    off();

    expect(prisma.notification!.create!).toHaveBeenCalledTimes(1);
    expect(received).toEqual(['b']);
  });
});
