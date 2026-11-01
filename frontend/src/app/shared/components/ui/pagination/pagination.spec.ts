import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { formatCount, Pagination } from './pagination';

describe('Pagination', () => {
  let fixture: ComponentFixture<Pagination>;

  function render(offset: number, total: number, isLoading = false): HTMLElement {
    fixture.componentRef.setInput('offset', offset);
    fixture.componentRef.setInput('limit', 20);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('isLoading', isLoading);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function buttons(element: HTMLElement): HTMLIonButtonElement[] {
    return Array.from(element.querySelectorAll('ion-button'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Pagination],
      providers: [provideIonicAngular()],
    });
    fixture = TestBed.createComponent(Pagination);
  });

  it('groups thousands with a non-breaking space, also with four digits', () => {
    expect(formatCount(1284)).toBe('1\u00a0284');
    expect(formatCount(1234567)).toBe('1\u00a0234\u00a0567');
    expect(formatCount(20)).toBe('20');
  });

  it('shows the range of the first page and only allows going forward', () => {
    const element = render(0, 1284);

    expect(element.querySelector('.pagination__range')?.textContent).toBe('1–20 de 1\u00a0284');
    const [previous, next] = buttons(element);
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
  });

  it('stops at the total on the last page', () => {
    const element = render(1280, 1284);

    expect(element.querySelector('.pagination__range')?.textContent).toBe(
      '1\u00a0281–1\u00a0284 de 1\u00a0284',
    );
    const [previous, next] = buttons(element);
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);
  });

  it('shows an empty list and disables both buttons while loading', () => {
    expect(render(0, 0).querySelector('.pagination__range')?.textContent).toBe('0 de 0');

    const [previous, next] = buttons(render(20, 100, true));
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
  });

  it('emits the offset of the previous and the next page', () => {
    const offsets: number[] = [];
    fixture.componentInstance.offsetChange.subscribe((offset) => offsets.push(offset));
    render(20, 100);

    fixture.componentInstance.handlePrevious();
    fixture.componentInstance.handleNext();

    expect(offsets).toEqual([0, 40]);
  });
});
