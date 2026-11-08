import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { AdminCatalogsService } from './admin-catalogs.service';

describe('AdminCatalogsService', () => {
  let catalogs: AdminCatalogsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    catalogs = TestBed.inject(AdminCatalogsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists a catalog, taking the avatar id as its key', async () => {
    const brands = catalogs.list('vehicle-brands');
    http
      .expectOne('/api/admin/catalogs/vehicle-brands?limit=100')
      .flush([{ key: 'seat', name: 'SEAT', isActive: true, sortOrder: 0 }]);
    await expect(brands).resolves.toEqual([
      { key: 'seat', name: 'SEAT', isActive: true, sortOrder: 0 },
    ]);

    const avatars = catalogs.list('avatars');
    http
      .expectOne('/api/admin/catalogs/avatars?limit=100')
      .flush([{ id: 'sun', name: 'Sol', isActive: true, sortOrder: 1, svg: '<svg/>' }]);
    await expect(avatars).resolves.toMatchObject([{ key: 'sun', name: 'Sol' }]);
  });

  it('creates, changes and moves an item', async () => {
    const created = catalogs.create('vehicle-colors', {
      name: 'Oro',
      hexLight: '#c9a227',
      hexDark: '#e0c060',
    });
    const post = http.expectOne('/api/admin/catalogs/vehicle-colors');
    expect(post.request.method).toBe('POST');
    post.flush({ key: 'oro', name: 'Oro', isActive: true, sortOrder: 8 });
    await expect(created).resolves.toMatchObject({ key: 'oro' });

    const updated = catalogs.update('vehicle-colors', 'oro', { isActive: false });
    const patch = http.expectOne('/api/admin/catalogs/vehicle-colors/oro');
    expect(patch.request.body).toEqual({ isActive: false });
    patch.flush({ key: 'oro', name: 'Oro', isActive: false, sortOrder: 8 });
    await expect(updated).resolves.toMatchObject({ isActive: false });

    const moved = catalogs.move('vehicle-colors', 'oro', 'up');
    const move = http.expectOne('/api/admin/catalogs/vehicle-colors/oro/move');
    expect(move.request.body).toEqual({ direction: 'up' });
    move.flush({ key: 'oro' });
    await expect(moved).resolves.toBeUndefined();
  });

  it('replaces the image of an avatar as multipart', async () => {
    const image = new File([new Uint8Array([1, 2, 3])], 'buho.png', { type: 'image/png' });
    const replaced = catalogs.replaceAvatarImage('buho', image);
    const request = http.expectOne('/api/admin/catalogs/avatars/buho/image');
    expect(request.request.method).toBe('PUT');
    expect((request.request.body as FormData).get('image')).toBe(image);
    request.flush({ id: 'buho' });
    await expect(replaced).resolves.toBeUndefined();
  });

  it('uploads an avatar as multipart and turns errors into ApiError', async () => {
    const image = new File([new Uint8Array([1, 2, 3])], 'buho.png', { type: 'image/png' });
    const uploaded = catalogs.uploadAvatar('Búho', image);
    const request = http.expectOne('/api/admin/catalogs/avatars');
    const body = request.request.body as FormData;
    expect(body.get('name')).toBe('Búho');
    expect(body.get('image')).toBe(image);
    request.flush(
      { code: 'INVALID_AVATAR_IMAGE' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await expect(uploaded).rejects.toBeInstanceOf(ApiError);
  });
});
