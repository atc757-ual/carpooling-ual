import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationsService } from './conversations.service';
import { ChatReportsService } from './chat-reports.service';
import { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { ConversationView } from './conversations.service';
import { Trip } from '../trips/entities/trip.entity';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: jest.Mocked<Partial<ChatService>>;
  let conversationsService: jest.Mocked<Partial<ConversationsService>>;
  let chatReportsService: jest.Mocked<Partial<ChatReportsService>>;

  const user: AccessTokenPayload = {
    sub: 'user-1',
    email: 'user1@ual.es',
    profiles: ['driver'],
  };

  const trip = {
    id: 'trip-1',
    driverId: 'user-1',
    status: 'confirmed',
    originName: 'Almería',
    destinationName: 'Campus UAL',
    departureAt: new Date('2026-11-20T08:00:00Z'),
  } as Trip;

  const conversationView: ConversationView = {
    trip,
    driver: { name: 'Juan', avatarKey: 'sun' },
    myRole: 'driver',
    lastMessage: null,
    unreadCount: 0,
    isOpen: true,
  };

  beforeEach(() => {
    chatService = {
      listMessages: jest.fn(),
      sendMessage: jest.fn(),
      markRead: jest.fn(),
      listContacts: jest.fn(),
    };
    conversationsService = {
      listForUser: jest.fn(),
      getForTrip: jest.fn(),
    };
    chatReportsService = {
      reportChat: jest.fn(),
    };

    controller = new ChatController(
      chatService as unknown as ChatService,
      conversationsService as unknown as ConversationsService,
      chatReportsService as unknown as ChatReportsService,
    );
  });

  describe('getConversation', () => {
    it('returns the conversation resource for a trip', async () => {
      (conversationsService.getForTrip as jest.Mock).mockResolvedValue(
        conversationView,
      );

      const result = await controller.getConversation(user, 'trip-1');

      expect(conversationsService.getForTrip).toHaveBeenCalledWith(
        'user-1',
        'trip-1',
      );
      expect(result.id).toBe('trip-1');
      expect(result.myRole).toBe('driver');
      expect(result.isOpen).toBe(true);
      expect(result.trip.originName).toBe('Almería');
      expect(result.trip.driverName).toBe('Juan');
      expect(result.trip.driverAvatarKey).toBe('sun');
    });
  });
});
