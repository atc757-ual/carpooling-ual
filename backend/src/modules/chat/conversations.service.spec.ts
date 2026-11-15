import { Repository } from 'typeorm';
import { ConversationsService } from './conversations.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRead } from './entities/chat-read.entity';
import { ChatMessageView, ChatService } from './chat.service';
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
      getConversation: jest.fn().mockResolvedValue({
        trip: mockTrip,
        role: 'driver',
        passengerId: 'passenger-1',
        otherUserId: 'passenger-1',
      }),
      toViews: jest.fn().mockResolvedValue([]),
    };
    tripsService = {};
    requestsService = {
      acceptedTripIdsOfPassenger: jest.fn(),
    };
    usersService = {
      getPublicProfiles: jest.fn().mockResolvedValue(
        new Map([
          ['driver-1', { name: 'Lucía', avatarKey: 'sun' }],
          ['passenger-1', { name: 'Pía', avatarKey: null }],
        ]),
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
        .mockResolvedValueOnce([]); // unreadCounts
      (messagesRepository.findBy as jest.Mock).mockResolvedValueOnce([]);

      const ref = { tripId: 'trip-1', passengerId: 'passenger-1' };
      const result = await service.getForTrip('driver-1', ref);

      expect(chat.getConversation).toHaveBeenCalledWith('driver-1', ref);
      expect(result.trip).toBe(mockTrip);
      expect(result.myRole).toBe('driver');
      expect(result.driver).toEqual({ name: 'Lucía', avatarKey: 'sun' });
      expect(result.passenger).toEqual({
        id: 'passenger-1',
        name: 'Pía',
        avatarKey: null,
      });
      expect(result.lastMessage).toBeNull();
      expect(result.unreadCount).toBe(0);
      expect(result.isOpen).toBe(true);
    });

    it('takes the newest of the direct and the former shared messages as the last one', async () => {
      const message = (id: string, passengerId: string | null, at: string) =>
        ({
          id,
          tripId: 'trip-1',
          passengerId,
          createdAt: new Date(at),
        }) as unknown as ChatMessage;
      const direct = message('msg-1', 'passenger-1', '2026-11-15T08:00:00Z');
      const shared = message('msg-0', null, '2026-11-14T08:00:00Z');
      const messageView = { message: direct } as unknown as ChatMessageView;

      (messagesRepository.query as jest.Mock)
        .mockResolvedValueOnce([{ id: 'msg-0' }, { id: 'msg-1' }]) // lastMessages
        .mockResolvedValueOnce([
          { trip_id: 'trip-1', passenger_id: 'passenger-1', count: 2 },
        ]); // unreadCounts
      (messagesRepository.findBy as jest.Mock).mockResolvedValueOnce([
        shared,
        direct,
      ]);
      (chat.toViews as jest.Mock).mockResolvedValueOnce([messageView]);

      const result = await service.getForTrip('user-1', {
        tripId: 'trip-1',
        passengerId: 'passenger-1',
      });

      expect(chat.toViews).toHaveBeenCalledWith(mockTrip, [direct]);
      expect(result.lastMessage).toEqual(messageView);
      expect(result.unreadCount).toBe(2);
    });

    it('takes the former shared message when the conversation has none', async () => {
      const shared = {
        id: 'msg-0',
        tripId: 'trip-1',
        passengerId: null,
        createdAt: new Date('2026-11-14T08:00:00Z'),
      } as unknown as ChatMessage;
      (messagesRepository.query as jest.Mock)
        .mockResolvedValueOnce([{ id: 'msg-0' }])
        .mockResolvedValueOnce([]);
      (messagesRepository.findBy as jest.Mock).mockResolvedValueOnce([shared]);

      await service.getForTrip('user-1', { tripId: 'trip-1' });

      expect(chat.toViews).toHaveBeenCalledWith(mockTrip, [shared]);
    });
  });
});
