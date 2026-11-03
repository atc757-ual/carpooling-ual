import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DeclarationDocument } from '../declaration-modal/declaration-modal';
import { DeclarationField } from './declaration-field';

describe('DeclarationField', () => {
  async function readWith(
    role: string,
    document: DeclarationDocument = 'driver_declaration',
  ): Promise<{ control: FormControl<boolean>; create: ReturnType<typeof vi.spyOn>; text: string }> {
    TestBed.configureTestingModule({
      imports: [DeclarationField],
      providers: [provideIonicAngular()],
    });
    const create = vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onWillDismiss: () => Promise.resolve({ role }),
    } as unknown as HTMLIonModalElement);
    const control = new FormControl(false, { nonNullable: true });
    const fixture = TestBed.createComponent(DeclarationField);
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('document', document);
    fixture.detectChanges();

    await fixture.componentInstance.handleRead();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    return { control, create, text };
  }

  it('ticks the box when the declaration is accepted in its window', async () => {
    expect((await readWith('accept')).control.value).toBe(true);
  });

  it('leaves it as it was when the window is closed', async () => {
    expect((await readWith('backdrop')).control.value).toBe(false);
  });

  it('opens the declaration of the vehicle with its own text', async () => {
    const { create, text } = await readWith('accept', 'vehicle_declaration');

    expect(text).toContain('seguro obligatorio en vigor');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ componentProps: { document: 'vehicle_declaration' } }),
    );
  });
});
