import { plainToInstance } from 'class-transformer';
import { ListConversationsQueryDto } from './list-conversations-query.dto';

describe('ListConversationsQueryDto', () => {
  it('transforms hasUnread string "true" and "false" into booleans and keeps other values as-is', () => {
    const withTrue = plainToInstance(ListConversationsQueryDto, {
      hasUnread: 'true',
    });
    const withFalse = plainToInstance(ListConversationsQueryDto, {
      hasUnread: 'false',
    });
    const withOther = plainToInstance(ListConversationsQueryDto, {
      hasUnread: 'invalid',
    });

    expect(withTrue.hasUnread).toBe(true);
    expect(withFalse.hasUnread).toBe(false);
    expect(withOther.hasUnread).toBe('invalid');
  });
});
