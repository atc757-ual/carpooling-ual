import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { HelpFaq } from '../../../../core/models/faq.model';
import { FaqsService } from '../../../../core/services/help/faqs.service';
import { ActiveModeService } from '../../../../core/services/users/active-mode.service';
import { QuickFaqs } from './quick-faqs';

const FAQ: HelpFaq = {
  id: 'faq-1',
  topic: 'search',
  audience: 'passenger',
  quickContexts: ['search'],
  question: '¿Qué es el margen horario?',
  answer: 'Cuánto antes o después te viene bien.',
  points: [],
};

describe('QuickFaqs', () => {
  let list: ReturnType<typeof vi.fn>;

  async function render(): Promise<ComponentFixture<QuickFaqs>> {
    list = vi.fn().mockResolvedValue([FAQ]);
    TestBed.configureTestingModule({
      imports: [QuickFaqs],
      providers: [
        provideIonicAngular(),
        // Para que el enlace a Ayuda y soporte tenga adónde ir
        provideRouter([{ path: '**', children: [] }]),
        { provide: FaqsService, useValue: { list } },
        { provide: ActiveModeService, useValue: { mode: signal('driver') } },
      ],
    });
    const fixture = TestBed.createComponent(QuickFaqs);
    fixture.componentRef.setInput('context', 'search');
    await fixture.whenStable();
    return fixture;
  }

  it('asks for the quick questions of the screen, for the active mode', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(list).toHaveBeenCalledWith({ lang: 'es', audience: 'driver', context: 'search' });
    expect(root.textContent).toContain('¿Qué es el margen horario?');
  });

  it('links to Help & support and says so when it is pressed', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const more = vi.fn();
    fixture.componentInstance.more.subscribe(more);

    const button = root.querySelector<HTMLElement>('.quick-faqs__more');
    expect(button?.textContent).toContain('Ver todas las preguntas');
    button?.click();
    await fixture.whenStable();

    expect(more).toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/tabs/profile/help');
  });
});
