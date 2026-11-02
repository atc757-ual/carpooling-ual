import { catalogConfig, itemDetail, itemImage } from './catalog-config';

describe('catalog config', () => {
  it('finds the catalog of the URL, or the first one', () => {
    expect(catalogConfig('avatars').creation).toBe('upload');
    expect(catalogConfig('travel-preferences').creation).toBe('none');
    expect(catalogConfig('nope').id).toBe('vehicle-brands');
    expect(catalogConfig(undefined).id).toBe('vehicle-brands');
  });

  it('describes each kind of item in one small line', () => {
    const base = { key: 'k', name: 'N', isActive: true, sortOrder: 0 };
    expect(itemDetail({ ...base, preference: 'music', nameEn: 'Soft music' })).toBe(
      'Música · Soft music',
    );
    expect(itemDetail({ ...base, hexLight: '#2673c9', hexDark: '#5b9be0' })).toBe(
      '#2673c9 · #5b9be0',
    );
    expect(itemDetail({ ...base, svg: '<svg/>' })).toBe('SVG de la plataforma');
    expect(itemDetail(base)).toBeNull();
  });

  it('builds the image link of an uploaded avatar', () => {
    const base = { key: 'buho', name: 'Búho', isActive: true, sortOrder: 0 };
    expect(itemImage({ ...base, imageHref: '/api/avatars/buho/image' })).toBe(
      '/api/avatars/buho/image',
    );
    expect(itemImage({ ...base, imageHref: null })).toBeNull();
  });
});
