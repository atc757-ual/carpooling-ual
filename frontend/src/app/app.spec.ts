import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideIonicAngular(), provideRouter([])],
    }).compileComponents();
  });

  it('starts with the Ionic container and the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance).toBeInstanceOf(App);
    expect(root.querySelector('ion-app ion-router-outlet')).not.toBeNull();
  });
});
