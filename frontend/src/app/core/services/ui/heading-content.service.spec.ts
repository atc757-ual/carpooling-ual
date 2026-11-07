import { TemplateRef } from '@angular/core';
import { HeadingContentService } from './heading-content.service';

describe('HeadingContentService', () => {
  it('shows a template and only clears it if it is still the same', () => {
    const heading = new HeadingContentService();
    const mine = {} as TemplateRef<unknown>;
    const other = {} as TemplateRef<unknown>;

    heading.show(mine);
    expect(heading.content()).toBe(mine);
    heading.show(other);
    heading.clear(mine);
    expect(heading.content()).toBe(other);
    heading.clear(other);
    expect(heading.content()).toBeNull();
  });
});
