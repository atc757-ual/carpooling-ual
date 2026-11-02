import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminSimulationsService } from '../../../core/services/admin/admin-simulations.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { AdminSimulationPage } from './admin-simulation.page';
import { RESULTS, RUN, SCENARIOS } from './simulation.testing';

describe('AdminSimulationPage', () => {
  let fixture: ComponentFixture<AdminSimulationPage>;
  const simulations = {
    scenarios: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    results: vi.fn(),
    start: vi.fn(),
    cancel: vi.fn(),
    csv: vi.fn(),
  };
  const ask = vi.fn();

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminSimulationPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AdminSimulationsService, useValue: simulations },
        { provide: ConfirmService, useValue: { ask } },
      ],
    });
    fixture = TestBed.createComponent(AdminSimulationPage);
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    for (let round = 0; round < 3; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    simulations.scenarios.mockResolvedValue(SCENARIOS);
    simulations.list.mockResolvedValue({ items: [], total: 0 });
    simulations.get.mockResolvedValue(RUN);
    simulations.results.mockResolvedValue(RESULTS);
  });

  it('starts S1 against S0 by default and opens the new run', async () => {
    const root = await render();
    expect(root.textContent).toContain('Aún no hay ejecuciones');
    expect(fixture.componentInstance.startLabel()).toBe('Ejecutar S1 frente a S0');
    simulations.start.mockResolvedValue({ ...RUN, status: 'queued', progress: 0 });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.handleStart();

    expect(simulations.start).toHaveBeenCalledWith({
      scenario: 'S1',
      baselineScenario: 'S0',
      replicas: 30,
      seed: 20261101,
    });
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { run: 'r1' } }),
    );
  });

  it('does not start with invalid numbers and shows the API error', async () => {
    await render();
    fixture.componentInstance.handleNumber(
      'replicas',
      new CustomEvent('ionInput', { detail: { value: '0' } }),
    );
    await fixture.componentInstance.handleStart();
    expect(simulations.start).not.toHaveBeenCalled();

    // Elegir escenario pone sus réplicas; después se cambian
    fixture.componentInstance.handleScenario('S0');
    fixture.componentInstance.handleNumber(
      'replicas',
      new CustomEvent('ionInput', { detail: { value: '5' } }),
    );
    simulations.start.mockRejectedValue(new ApiError('SIMULATION_ALREADY_RUNNING', 409));
    await fixture.componentInstance.handleStart();

    expect(simulations.start).toHaveBeenCalledWith(
      expect.objectContaining({ scenario: 'S0', replicas: 5 }),
    );
    expect(fixture.componentInstance.startError()).toContain('Ya hay una simulación en marcha');
  });

  it('shows the latest finished run with its results and history', async () => {
    simulations.list.mockResolvedValue({ items: [RUN], total: 1 });

    const root = await render();

    expect(simulations.get).toHaveBeenCalledWith('r1');
    expect(root.querySelector('app-simulation-results')?.textContent).toContain(
      '30/30 réplicas · criterio cumplido',
    );
    expect(root.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toContain(
      '07:00: S0 10, S1 8',
    );
    expect(root.querySelector('.simulation__table')?.textContent).toContain('S1 frente a S0');
  });

  it('polls a running run every 2 seconds until it finishes', async () => {
    simulations.list.mockResolvedValue({ items: [RUN], total: 1 });
    simulations.get.mockResolvedValue({ ...RUN, status: 'running', progress: 12 });
    const root = await render();
    expect(root.textContent).toContain('12/30 réplicas');

    simulations.get.mockResolvedValue(RUN);
    await new Promise((resolve) => setTimeout(resolve, 2100));
    await settle();

    expect(simulations.get).toHaveBeenCalledTimes(2);
    expect(simulations.list).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.isRunning()).toBe(false);
  }, 10_000);

  it('cancels a running run after confirming it', async () => {
    simulations.list.mockResolvedValue({ items: [RUN], total: 1 });
    simulations.get.mockResolvedValue({ ...RUN, status: 'running', progress: 3 });
    await render();
    ask.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    simulations.cancel.mockResolvedValue({ ...RUN, status: 'cancelled' });

    await fixture.componentInstance.handleCancel();
    expect(simulations.cancel).not.toHaveBeenCalled();
    await fixture.componentInstance.handleCancel();
    expect(simulations.cancel).toHaveBeenCalledWith('r1');
    fixture.destroy();
  });

  it('explains a cancelled run has no results and exports the CSV of a finished one', async () => {
    simulations.list.mockResolvedValue({ items: [RUN], total: 1 });
    simulations.get.mockResolvedValue({ ...RUN, status: 'cancelled', criterionMet: null });
    const root = await render();
    expect(root.textContent).toContain('Se canceló antes de terminar');

    simulations.csv.mockResolvedValue(new Blob(['replica']));
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    await fixture.componentInstance.handleExport();
    expect(simulations.csv).toHaveBeenCalledWith('r1');
    expect(createUrl).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:csv');
  });
});
