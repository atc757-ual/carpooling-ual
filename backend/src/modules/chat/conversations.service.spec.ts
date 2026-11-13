import { Repository } from 'typeorm';
import { ConversationsService } from './conversations.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRead } from './entities/chat-read.entity';
import { ChatService } from './chat.service';
import { TripsService } from '../trips/trips.service';
import { RequestsService } from '../requests/requests.service';
import { UsersService } from '../users/users.service';
import { Trip } from '../trips/entities/trip.entity';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let messagesRepository: jest.Mocked<Partial<Repository<ChatMessage>>>;
  let readsRepository: jest.Mocked<Partial<Repository<ChatRead>>>;
  let chat: jest.Mocked<Partial<ChatService>>;
  let tripsService: jest.Mocked<Partial<TripsService>>;
  let requestsService: jest.Mocked<Partial<RequestsService>>;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const mockTrip = {
    id: 'trip-1',
    driverId: 'driver-1',
    status: 'confirmed',
    departureAt: new Date(Date.now() + 3600000),
  } as Trip;

  beforeEach(() => {
    messagesRepository = {
      query: jest.fn(),
      findBy: jest.fn(),
    };
    readsRepository = {
      query: jest.fn(),
    };
    chat = {
      getAccess: jest
        .fn()
        .mockResolvedValue({ trip: mockTrip, role: 'driver' }),
      toViews: jest.fn().mockResolvedValue([]),
    };
    tripsService = {};
    requestsService = {
      acceptedTripIdsOfPassenger: jest.fn(),
    };
    usersService = {
      getPublicProfiles: jest
        .fn()
        .mockResolvedValue(
          new Map([['driver-1', { name: 'Lucía', avatarKey: 'sun' }]]),
        ),
    };

    service = new ConversationsService(
      messagesRepository as unknown as Repository<ChatMessage>,
      readsRepository as unknown as Repository<ChatRead>,
      chat as unknown as ChatService,
      tripsService as unknown as TripsService,
      requestsService as unknown as RequestsService,
      usersService as unknown as UsersService,
    );
  });

  describe('getForTrip', () => {
    it('returns the conversation view when there are no messages', async () => {
      (messagesRepository.query as jest.Mock)
        .mockResolvedValueOnce([]) // lastMessages ids
        .mockResolvedValueOnce([{ trip_id: 'trip-1', count: 0 }]); // unreadCounts
      (messagesRepository.findBy as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getForTrip('user-1', 'trip-1');

      expect(chat.getAccess).toHaveBeenCalledWith('user-1', 'trip-1');
      expect(result.trip).toBe(mockTrip);
      expect(result.myRole).toBe('driver');
      expect(result.driver).toEqual({ name: 'Lucía', avatarKey: 'sun' });
      expect(result.lastMessage).toBeNull();
      expect(result.unreadCount).toBe(0);
      expect(result.isOpen).toBe(true);
    });

    it('returns the conversation view with last message when present', async () => {
      const message = {
        id: 'msg-1',
        tripId: 'trip-1',
        text: 'Hola',
      } as ChatMessage;
      const messageView = { id: 'msg-1', text: 'Hola' } as any;

      (messagesRepository.query as jest.Mock)
        .mockResolvedValueOnce([{ id: 'msg-1' }]) // lastMessages query
        .mockResolvedValueOnce([{ trip_id: 'trip-1', count: 2 }]); // unreadCounts query
      (messagesRepository.findBy as jest.Mock).mockResolvedValueOnce([message]);
      (chat.toViews as jest.Mock).mockResolvedValueOnce([messageView]);

      const result = await service.getForTrip('user-1', 'trip-1');

      expect(result.lastMessage).toEqual(messageView);
      expect(result.unreadCount).toBe(2);
    });
  });
});
