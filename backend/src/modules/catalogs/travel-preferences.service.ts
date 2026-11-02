import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { CatalogItemsService } from './catalog-items.service';
import { TravelPreferenceOption } from './entities/travel-preference-option.entity';

// Opciones de las preferencias de viaje (catálogo del panel): sus textos en
// español e inglés, su orden dentro de cada preferencia y si se ofrecen
@Injectable()
export class TravelPreferencesService extends CatalogItemsService<TravelPreferenceOption> {
  constructor(
    private readonly optionsDataSource: DataSource,
    events: EventsService,
  ) {
    super(
      {
        name: 'travel_preference_options',
        entity: TravelPreferenceOption,
        keyConstraint: 'travel_preference_options_key_key',
        groupedBy: 'preference',
      },
      optionsDataSource,
      events,
    );
  }

  // Si se puede elegir esa opción (quien ya la tenía la conserva aunque deje
  // de ofrecerse)
  isOffered(preference: string, value: string): Promise<boolean> {
    return this.optionsDataSource.manager.existsBy(TravelPreferenceOption, {
      preference,
      value,
      isActive: true,
    });
  }

  protected override payloadOf(
    option: TravelPreferenceOption,
  ): Record<string, unknown> {
    return {
      ...super.payloadOf(option),
      preference: option.preference,
      value: option.value,
      nameEn: option.nameEn,
    };
  }
}
