import { TestBed } from '@angular/core/testing';
import { CollapsingHeadingService } from './collapsing-heading.service';

describe('CollapsingHeadingService', () => {
  let heading: CollapsingHeadingService;

  beforeEach(() => {
    heading = TestBed.inject(CollapsingHeadingService);
  });

  it('hides the strip when scrolling down and shows it when scrolling up', () => {
    heading.track(100);
    expect(heading.isHidden()).toBe(true);

    heading.track(80);
    expect(heading.isHidden()).toBe(false);
  });

  it('ignores short scrolls in either direction', () => {
    heading.track(100);
    heading.track(95);
    heading.track(105);
    expect(heading.isHidden()).toBe(true);
  });

  it('always shows it near the top and after a reset', () => {
    heading.track(200);
    heading.track(40);
    expect(heading.isHidden()).toBe(false);

    heading.track(200);
    heading.reset();
    expect(heading.isHidden()).toBe(false);
  });
});
