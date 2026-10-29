import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Combobox, ComboboxState } from './combobox';

// Un ion-input de mentira: solo lo que usa la directiva
@Component({
  imports: [Combobox],
  template: `<ion-input [appCombobox]="combobox"></ion-input
    ><button type="button">Siguiente</button>`,
})
class HostComponent {
  readonly options = signal(['a', 'b', 'c']);
  readonly choose = vi.fn();
  readonly combobox = new ComboboxState(
    () => this.options().length,
    (index) => this.choose(this.options()[index]),
  );
}

describe('Combobox', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let field: HTMLInputElement;
  let ionInput: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    field = document.createElement('input');
    ionInput = fixture.nativeElement.querySelector('ion-input') as HTMLElement;
    Object.assign(ionInput, { getInputElement: () => Promise.resolve(field) });
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function press(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    ionInput.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  it('makes the real field a combobox with the first option highlighted', () => {
    expect(field.getAttribute('role')).toBe('combobox');
    expect(field.getAttribute('aria-controls')).toBe(host.combobox.listId);
    expect(field.getAttribute('aria-expanded')).toBe('true');
    expect(field.getAttribute('aria-activedescendant')).toBe(host.combobox.optionId(0));
  });

  it('moves with the arrows, going round, and chooses with Enter', async () => {
    expect(press('ArrowDown').defaultPrevented).toBe(true);
    press('ArrowUp');
    press('ArrowUp');
    await fixture.whenStable();

    expect(host.combobox.activeIndex()).toBe(2);
    expect(field.getAttribute('aria-activedescendant')).toBe(host.combobox.optionId(2));
    expect(press('Enter').defaultPrevented).toBe(true);
    expect(host.choose).toHaveBeenCalledWith('c');
  });

  it('chooses the first one with Tab and moves the focus to what comes next', async () => {
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(host.choose).toHaveBeenCalledWith('a');

    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement?.textContent).toBe('Siguiente');
  });

  it('lets Enter submit and Tab leave without choosing once closed with Escape', () => {
    press('Escape');

    expect(host.combobox.isOpen()).toBe(false);
    expect(press('Enter').defaultPrevented).toBe(false);
    press('Tab');
    expect(host.choose).not.toHaveBeenCalled();
  });

  it('opens again when typing or with ↓', () => {
    press('Escape');
    ionInput.dispatchEvent(new CustomEvent('ionInput'));
    expect(host.combobox.isOpen()).toBe(true);

    press('Escape');
    press('ArrowDown');
    expect(host.combobox.isOpen()).toBe(true);
    expect(host.combobox.activeIndex()).toBe(0);
  });

  it('closes when leaving the field and opens again when coming back', () => {
    ionInput.dispatchEvent(new CustomEvent('ionBlur'));
    expect(host.combobox.isOpen()).toBe(false);

    ionInput.dispatchEvent(new CustomEvent('ionFocus'));
    expect(host.combobox.isOpen()).toBe(true);
  });

  it('does nothing without options', () => {
    host.options.set([]);

    expect(press('ArrowDown').defaultPrevented).toBe(true);
    press('Tab');
    expect(host.combobox.isOpen()).toBe(false);
    expect(host.combobox.activeId()).toBeNull();
    expect(host.choose).not.toHaveBeenCalled();
  });
});
