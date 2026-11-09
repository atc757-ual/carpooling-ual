import { Injectable, OnModuleInit } from '@nestjs/common';
import { TripViewerAccessService } from '../trips/trip-viewer-access.service';
import { RequestsService } from './requests.service';

// Los pasajeros aceptados ven el origen, el destino y la ruta exactos de su
// viaje: se lo dice a trips sin que trips dependa de las solicitudes
// (patrón observador, como TripChangesListener)
@Injectable()
export class TripParticipantsRegistration implements OnModuleInit {
  constructor(
    private readonly viewerAccess: TripViewerAccessService,
    private readonly requestsService: RequestsService,
  ) {}

  onModuleInit(): void {
    this.viewerAccess.onParticipantCheck((tripId, userId) =>
      this.requestsService.isAcceptedPassenger(tripId, userId),
    );
  }
}
