import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../../core/models/api-error.model';
import { AdminSimulationSweepsService } from '../../../../core/services/admin/admin-simulation-sweeps.service';
import { SensitivitySweep } from './sensitivity-sweep';
import { RUNNING_SWEEP, SWEEP } from './sweep.testing';

describe('SensitivitySweep', () => {
  let fixture: ComponentFixture<SensitivitySweep>;
  const sweeps = { latest: vi.fn(), get: vi.fn(), start: vi.fn() };

  async function render(inputs: { isBlocked?: boolean } = {}): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [SensitivitySweep],
      providers: [
        provideIonicAngular(),
        { provide: AdminSimulationSweepsService, useValue: sweeps },
      ],
    });
    fixture = TestBed.createComponent(SensitivitySweep);
    fixture.componentRef.setInput('scenario', 'S1');
    fixture.componentRef.setInput('replicas', 30);
    fixture.componentRef.setInput('seed', 7);
    fixture.componentRef.setInput('isBlocked', inputs.isBlocked ?? false);
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
    sweeps.latest.mockResolvedValue(null);
  });

  afterEach(() => vi.useRealTimers());

  it('offers the values of the thesis for each assumption', async () => {
    await render();
    const sweep = fixture.componentInstance;

    expect(sweep.valuesText()).toBe('20, 30, 50');
    expect(sweep.startLabel()).toBe('Analizar S1 con estos valores');
    sweep.handleParameter('adoptionRate');
    expect(sweep.valuesText()).toBe('10, 30, 50');
    sweep.handleParameter('speed');
    expect(sweep.parameter()).toBe('adoptionRate');
  });

  it('starts the sweep with the scenario of the page and shows it', async () => {
    const started = vi.fn();
    await render();
    fixture.componentInstance.started.subscribe(started);
    sweeps.start.mockResolvedValue(SWEEP);
    sweeps.get.mockResolvedValue(SWEEP);

    await fixture.componentInstance.handleStart();
    await settle();

    expect(sweeps.start).toHaveBeenCalledWith({
      scenario: 'S1',
      baselineScenario: 'S0',
      replicas: 30,
      seed: 7,
      parameter: 'ownCarShare',
      values: [0.2, 0.3, 0.5],
    });
    expect(sweeps.get).toHaveBeenCalledWith('sweep-1');
    expect(started).toHaveBeenCalled();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-sensitivity-chart')).not.toBeNull();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(root.textContent).toContain('Terminado');
  });

  it('does not start with invalid values or while another run is active', async () => {
    await render({ isBlocked: true });
    const sweep = fixture.componentInstance;

    expect(sweep.canStart()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'el simulador atiende una a la vez',
    );
    fixture.componentRef.setInput('isBlocked', false);
    sweep.handleValues(new CustomEvent('ionInput', { detail: { value: '30' } }));
    expect(sweep.values()).toBeNull();
    expect(sweep.canStart()).toBe(false);

    await sweep.handleStart();
    expect(sweeps.start).not.toHaveBeenCalled();
  });

  it('says why the sweep could not start', async () => {
    await render();
    sweeps.start.mockRejectedValue(new ApiError('SIMULATION_ALREADY_RUNNING', 409));

    await fixture.componentInstance.handleStart();
    await settle();

    expect(fixture.componentInstance.startError()).not.toBeNull();
    expect(fixture.componentInstance.isStarting()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });

  it('shows the latest sweep and polls it while it runs', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    sweeps.latest.mockResolvedValue(RUNNING_SWEEP);
    const root = await render();

    expect(root.textContent).toContain('Variante 2 de 3 · 12/30 réplicas');
    expect(root.querySelector('ion-progress-bar')).not.toBeNull();
    expect(fixture.componentInstance.canStart()).toBe(false);

    sweeps.latest.mockResolvedValue(SWEEP);
    vi.advanceTimersByTime(2000);
    await settle();

    expect(sweeps.latest).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain('Terminado');
    expect(root.querySelector('ion-progress-bar')).toBeNull();
  });
});
