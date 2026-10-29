import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DeclarationField } from './declaration-field';

describe('DeclarationField', () => {
  async function readWith(role: string): Promise<FormControl<boolean>> {
    TestBed.configureTestingModule({
      imports: [DeclarationField],
      providers: [provideIonicAngular()],
    });
    vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onWillDismiss: () => Promise.resolve({ role }),
    } as unknown as HTMLIonModalElement);
    const control = new FormControl(false, { nonNullable: true });
    const fixture = TestBed.createComponent(DeclarationField);
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();

    await fixture.componentInstance.handleRead();

    return control;
  }

  it('ticks the box when the declaration is accepted in its window', async () => {
    expect((await readWith('accept')).value).toBe(true);
  });

  it('leaves it as it was when the window is closed', async () => {
    expect((await readWith('backdrop')).value).toBe(false);
  });
});
