import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AvatarResource } from '../../models/avatar.model';
import { AvatarsService } from './avatars.service';

describe('AvatarsService', () => {
  let avatars: AvatarsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    avatars = TestBed.inject(AvatarsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads and caches the selected avatar from the catalog', async () => {
    const first = avatars.getGraphic('sun');
    const second = avatars.getGraphic('wave');
    const request = http.expectOne('/api/avatars?offset=0&limit=100');
    expect(request.request.method).toBe('GET');
    request.flush(
      [
        {
          '@type': 'Avatar',
          id: 'sun',
          href: '/api/avatars/sun',
          name: 'Sol',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="20" /></svg>',
        },
        {
          '@type': 'Avatar',
          id: 'wave',
          href: '/api/avatars/wave',
          name: 'Ola',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M32 8v6" /></svg>',
        },
      ] satisfies AvatarResource[],
      { headers: { 'X-Total-Count': '2' } },
    );

    await expect(first).resolves.toMatchObject({
      viewBox: '0 0 64 64',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '3',
      shapes: [{ kind: 'circle', cx: '32', cy: '32', r: '20' }],
    });
    await expect(second).resolves.toMatchObject({
      shapes: [{ kind: 'path', d: 'M32 8v6' }],
    });
    expect(http.match('/api/avatars?offset=0&limit=100')).toHaveLength(0);
  });

  it('loads further pages when the catalog exceeds one page', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" /></svg>';
    const load = avatars.getGraphic('owl');
    http.expectOne('/api/avatars?offset=0&limit=100').flush(
      Array.from({ length: 100 }, () => ({
        '@type': 'Avatar' as const,
        id: 'sun' as const,
        href: '/api/avatars/sun',
        name: 'Sol',
        svg,
      })) satisfies AvatarResource[],
      { headers: { 'X-Total-Count': '101' } },
    );
    let secondPage: TestRequest | undefined;
    await vi.waitFor(() => {
      const requests = http.match('/api/avatars?offset=100&limit=100');
      expect(requests).toHaveLength(1);
      secondPage = requests[0];
    });
    secondPage?.flush(
      [
        { '@type': 'Avatar', id: 'owl', href: '/api/avatars/owl', name: 'Búho', svg },
      ] satisfies AvatarResource[],
      { headers: { 'X-Total-Count': '101' } },
    );

    await expect(load).resolves.toBeTruthy();
  });

  it('returns null when the selected key is not in the catalog', async () => {
    const load = avatars.getGraphic('sun');
    http.expectOne('/api/avatars?offset=0&limit=100').flush([], {
      headers: { 'X-Total-Count': '0' },
    });

    await expect(load).resolves.toBeNull();
  });

  it('rejects SVG elements outside the catalog graphic subset', async () => {
    const load = avatars.getGraphic('sun');
    http.expectOne('/api/avatars?offset=0&limit=100').flush(
      [
        {
          '@type': 'Avatar',
          id: 'sun',
          href: '/api/avatars/sun',
          name: 'Sol',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><script>alert(1)</script></svg>',
        },
      ] satisfies AvatarResource[],
      { headers: { 'X-Total-Count': '1' } },
    );

    await expect(load).resolves.toBeNull();
  });
});
