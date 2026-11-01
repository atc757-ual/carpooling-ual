import { TestBed } from '@angular/core/testing';
import { AvatarGraphic } from '../../../../core/models/avatar.model';
import { AvatarArt } from './avatar-art';

const GRAPHIC: AvatarGraphic = {
  viewBox: '0 0 64 64',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '3',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  shapes: [
    { kind: 'path', d: 'M0 0L10 10' },
    { kind: 'circle', cx: '32', cy: '32', r: '20' },
    { kind: 'rect', x: '10', y: '10', width: '20', height: '10', rx: '2', ry: '2' },
    { kind: 'polygon', points: '30,34 34,34 32,38' },
  ],
};

describe('AvatarArt', () => {
  it('draws every shape of the avatar in an SVG hidden from screen readers', () => {
    const fixture = TestBed.createComponent(AvatarArt);
    fixture.componentRef.setInput('graphic', GRAPHIC);
    fixture.detectChanges();

    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect([...(svg?.children ?? [])].map(({ tagName }) => tagName)).toEqual([
      'path',
      'circle',
      'rect',
      'polygon',
    ]);
    expect(svg?.querySelector('rect')?.getAttribute('width')).toBe('20');
  });
});
