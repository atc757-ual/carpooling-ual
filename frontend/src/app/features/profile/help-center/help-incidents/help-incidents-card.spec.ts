import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../../core/i18n/testing-transloco';
import { ApiError } from '../../../../core/models/api-error.model';
import type { MyIncidentPage } from '../../../../core/models/my-incident.model';
import { IncidentsService } from '../../../../core/services/incidents/incidents.service';
import { HelpIncidentModal } from './help-incident-modal';
import { HelpIncidentsCard } from './help-incidents-card';
import { MY_INCIDENT } from './my-incident.testing';

async function settle(fixture: ComponentFixture<HelpIncidentsCard>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('HelpIncidentsCard', () => {
  let listMine: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;

  async function render(
    load: () => Promise<MyIncidentPage>,
  ): Promise<ComponentFixture<HelpIncidentsCard>> {
    listMine = vi.fn(load);
    create = vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) });
    TestBed.configureTestingModule({
      imports: [HelpIncidentsCard],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: IncidentsService, useValue: { listMine } },
        { provide: ModalController, useValue: { create } },
      ],
    });
    const fixture = TestBed.createComponent(HelpIncidentsCard);
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  function text(fixture: ComponentFixture<HelpIncidentsCard>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('lists my incidents with their status', async () => {
    const fixture = await render(() => Promise.resolve({ items: [MY_INCIDENT], total: 1 }));

    expect(listMine).toHaveBeenCalledWith(0);
    expect(text(fixture)).toContain('INC-0004');
    const status = (fixture.nativeElement as HTMLElement).querySelector('.status');
    expect(status?.classList).toContain('status--pending');
    expect(fixture.nativeElement.querySelector('app-pagination')).toBeNull();
  });

  it('says so when there are none', async () => {
    const fixture = await render(() => Promise.resolve({ items: [], total: 0 }));

    expect(fixture.nativeElement.querySelector('.help-incidents__empty')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('ion-list')).toBeNull();
  });

  it('pages through them when there are more than five', async () => {
    const fixture = await render(() => Promise.resolve({ items: [MY_INCIDENT], total: 6 }));
    expect(fixture.nativeElement.querySelector('app-pagination')).not.toBeNull();

    fixture.componentInstance.handlePage(5);
    await settle(fixture);

    expect(listMine).toHaveBeenLastCalledWith(5);
  });

  it('shows the error and retries', async () => {
    const fixture = await render(() => Promise.reject(new ApiError('INTERNAL_ERROR', 500)));

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();

    listMine.mockResolvedValue({ items: [MY_INCIDENT], total: 1 });
    fixture.componentInstance.handleRetry();
    await settle(fixture);

    expect(text(fixture)).toContain('INC-0004');
  });

  it('opens the detail in a window', async () => {
    const fixture = await render(() => Promise.resolve({ items: [MY_INCIDENT], total: 1 }));

    await fixture.componentInstance.handleOpen(MY_INCIDENT);

    expect(create).toHaveBeenCalledWith({
      component: HelpIncidentModal,
      cssClass: 'info-dialog',
      componentProps: { incident: MY_INCIDENT },
    });
  });
});
