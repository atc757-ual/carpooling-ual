import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { EmailSuggestions } from './email-suggestions';

describe('EmailSuggestions', () => {
  let fixture: ComponentFixture<EmailSuggestions>;
  let control: FormControl<string>;

  beforeEach(() => {
    control = new FormControl('', { nonNullable: true });
    TestBed.configureTestingModule({ imports: [EmailSuggestions] });
    fixture = TestBed.createComponent(EmailSuggestions);
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
  });

  function type(value: string): string[] {
    control.setValue(value);
    fixture.detectChanges();
    return fixture.componentInstance.suggestions().map(({ email }) => email);
  }

  it('suggests nothing while the field is empty', () => {
    expect(type('')).toEqual([]);
  });

  it('completes the name with each UAL domain, students first', () => {
    expect(type('mario.perez')).toEqual(['mario.perez@inlumine.ual.es', 'mario.perez@ual.es']);
  });

  it('keeps only the domains that match what was typed after the @', () => {
    expect(type('mario@in')).toEqual(['mario@inlumine.ual.es']);
    expect(type('mario@u')).toEqual(['mario@ual.es']);
    expect(type('mario@gmail')).toEqual([]);
  });

  it('suggests nothing once the email is complete', () => {
    expect(type('mario@ual.es')).toEqual([]);
  });

  it('fills the field with the chosen suggestion', () => {
    type('mario');
    const options = (fixture.nativeElement as HTMLElement).querySelectorAll('button');

    options[1].click();
    fixture.detectChanges();

    expect(control.value).toBe('mario@ual.es');
    expect(control.dirty).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('ul')).toBeNull();
  });

  it('says who each domain is for', () => {
    type('mario');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Estudiantes');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Personal');
  });
});
