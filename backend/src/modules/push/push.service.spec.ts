import type { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { MemoryPushSender } from '../../shared/push/memory-push-sender';
import type { PushMessage } from '../../shared/push/push-sender';
import type { PushTokensService } from './push-tokens.service';
import { PushService } from './push.service';

const MESSAGE: PushMessage = {
  title: 'Hola',
  body: 'Texto',
  data: { type: 't' },
};

describe('PushService', () => {
  let sender: MemoryPushSender;
  let tokens: { recipientsOf: jest.Mock; removeInvalid: jest.Mock };
  let push: PushService;
  let subscribers: unknown[];

  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const inTransaction = (): {
    manager: EntityManager;
    queryRunner: QueryRunner;
  } => {
    const queryRunner = {
      isTransactionActive: true,
      data: {},
    } as unknown as QueryRunner;
    return {
      manager: { queryRunner } as unknown as EntityManager,
      queryRunner,
    };
  };

  beforeEach(() => {
    sender = new MemoryPushSender();
    tokens = {
      recipientsOf: jest.fn().mockResolvedValue({ tokens: ['t1'], fids: [] }),
      removeInvalid: jest.fn().mockResolvedValue(undefined),
    };
    subscribers = [];
    push = new PushService(
      { subscribers } as unknown as DataSource,
      tokens as unknown as PushTokensService,
      sender,
    );
  });

  it('subscribes to the transactions of the data source', () => {
    expect(subscribers).toEqual([push]);
  });

  it('sends after the commit, and nothing when the transaction is rolled back', async () => {
    const committed = inTransaction();
    push.queue(committed.manager, ['u1'], MESSAGE);
    await flush();
    expect(sender.sent).toHaveLength(0);
    push.afterTransactionCommit({
      queryRunner: committed.queryRunner,
    } as never);
    await flush();
    expect(sender.sent).toEqual([
      { recipients: { tokens: ['t1'], fids: [] }, message: MESSAGE },
    ]);

    const rolledBack = inTransaction();
    push.queue(rolledBack.manager, ['u1'], MESSAGE);
    push.afterTransactionRollback({
      queryRunner: rolledBack.queryRunner,
    } as never);
    push.afterTransactionCommit({
      queryRunner: rolledBack.queryRunner,
    } as never);
    await flush();
    expect(sender.sent).toHaveLength(1);
  });

  it('sends at once outside a transaction, and nothing without recipients or tokens', async () => {
    push.queue({} as EntityManager, ['u1'], MESSAGE);
    push.queue({} as EntityManager, [], MESSAGE);
    await flush();
    expect(sender.sent).toHaveLength(1);

    tokens.recipientsOf.mockResolvedValue({ tokens: [], fids: [] });
    await push.deliver({ userIds: ['u2'], message: MESSAGE });
    expect(sender.sent).toHaveLength(1);
  });

  it('drops the expired tokens and never fails when sending fails', async () => {
    sender.invalidTokens.add('t1');
    await push.deliver({ userIds: ['u1'], message: MESSAGE });
    expect(tokens.removeInvalid).toHaveBeenCalledWith(['t1']);

    tokens.recipientsOf.mockRejectedValue(new Error('database down'));
    await expect(
      push.deliver({ userIds: ['u1'], message: MESSAGE }),
    ).resolves.toBeUndefined();
  });
});
