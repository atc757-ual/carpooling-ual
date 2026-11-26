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
    passenger: { id: 'passenger-1', name: 'Pía', avatarKey: null },
    myRole: 'driver',
    lastMessage: null,
    unreadCount: 0,
    isOpen: true,
  };

  beforeEach(() => {
    chatService = {
      list: jest.fn(),
      send: jest.fn(),
      contacts: jest.fn(),
    };
    conversationsService = {
      listForUser: jest.fn(),
      getForTrip: jest.fn(),
      markRead: jest.fn(),
    };
    chatReportsService = {
      report: jest.fn(),
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

      const result = await controller.getConversation(user, 'trip-1', {
        passengerId: 'passenger-1',
      });

      expect(conversationsService.getForTrip).toHaveBeenCalledWith('user-1', {
        tripId: 'trip-1',
        passengerId: 'passenger-1',
      });
      expect(result.id).toBe('trip-1:passenger-1');
      expect(result.href).toBe(
        '/api/trips/trip-1/messages?passengerId=passenger-1',
      );
      expect(result.passenger).toEqual({
        id: 'passenger-1',
        name: 'Pía',
        avatarKey: null,
      });
      expect(result.myRole).toBe('driver');
      expect(result.isOpen).toBe(true);
      expect(result.trip.originName).toBe('Almería');
      expect(result.trip.driverName).toBe('Juan');
      expect(result.trip.driverAvatarKey).toBe('sun');
    });
  });
});
