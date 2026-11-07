import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IonContent, provideIonicAngular } from '@ionic/angular';
import { CollapsingHeadingService } from '../../core/services/ui/collapsing-heading.service';
import { CollapsingHeading } from './collapsing-heading.directive';

@Component({
  imports: [IonContent, CollapsingHeading],
  template: '<ion-content appCollapsingHeading />',
})
class HostPage {}

describe('CollapsingHeading', () => {
  it('turns on the scroll events and reports every scroll', () => {
    TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(HostPage);
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('ion-content') as HTMLIonContentElement;
    const track = vi.spyOn(TestBed.inject(CollapsingHeadingService), 'track');

    expect(content.scrollEvents).toBe(true);
    content.dispatchEvent(new CustomEvent('ionScroll', { detail: { scrollTop: 120 } }));
    expect(track).toHaveBeenCalledWith(120);
  });
});
