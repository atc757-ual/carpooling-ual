import { AdminCatalogItem } from '../../../core/models/admin-catalog.model';
import { CatalogCell, catalogConfig, itemImage } from './catalog-config';

describe('catalog config', () => {
  it('finds the catalog of the URL, or the first one', () => {
    expect(catalogConfig('avatars').creation).toBe('upload');
    expect(catalogConfig('travel-preferences').creation).toBe('none');
    expect(catalogConfig('nope').id).toBe('vehicle-brands');
    expect(catalogConfig(undefined).id).toBe('vehicle-brands');
  });

  describe('columns', () => {
    const base = { key: 'k', name: 'N', isActive: true, sortOrder: 0 };

    function cells(id: string, item: AdminCatalogItem): CatalogCell[] {
      return catalogConfig(id).columns.map((column) => column.cell(item));
    }

    function labels(id: string): string[] {
      return catalogConfig(id).columns.map((column) => column.label);
    }

    it('shows the name of a brand', () => {
      expect(labels('vehicle-brands')).toEqual(['Nombre']);
      expect(cells('vehicle-brands', base)).toEqual([{ text: 'N' }]);
    });

    it('shows both tones of a color with their swatch', () => {
      expect(labels('vehicle-colors')).toEqual(['Nombre', 'Claro', 'Oscuro']);
      expect(cells('vehicle-colors', { ...base, hexLight: '#111111', hexDark: '#222222' })).toEqual(
        [
          { text: 'N' },
          { text: '#111111', swatch: '#111111' },
          { text: '#222222', swatch: '#222222' },
        ],
      );
    });

    it('names the preference of an option and keeps an unknown one as it comes', () => {
      expect(labels('travel-preferences')).toEqual(['Preferencia', 'Valor', 'Inglés']);
      expect(cells('travel-preferences', { ...base, preference: 'music', nameEn: 'Soft' })).toEqual(
        [{ text: 'Música' }, { text: 'N' }, { text: 'Soft' }],
      );
      expect(cells('travel-preferences', { ...base, preference: 'nueva' })[0].text).toBe('nueva');
      expect(cells('travel-preferences', base)[2].text).toBe('');
    });

    it('shows the point of a parking', () => {
      expect(labels('campus-parkings')).toEqual(['Nombre', 'Coordenadas']);
      const item = {
        ...base,
        location: { type: 'Point' as const, coordinates: [-2.4045, 36.8322] as [number, number] },
      };
      expect(cells('campus-parkings', item)[1].text).toBe('36.83220, -2.40450');
      expect(cells('campus-parkings', base)[1].text).toBe('');
    });

    it('shows the image of an avatar, or says it is from the platform', () => {
      expect(labels('avatars')).toEqual(['Imagen', 'Nombre']);
      expect(cells('avatars', { ...base, imageHref: '/api/avatars/k/image' })[0]).toEqual({
        text: '',
        image: '/api/avatars/k/image',
      });
      expect(cells('avatars', { ...base, svg: '<svg/>' })[0]).toEqual({
        text: 'SVG de la plataforma',
        image: null,
      });
    });
  });

  it('builds the image link of an uploaded avatar', () => {
    const base = { key: 'buho', name: 'Búho', isActive: true, sortOrder: 0 };
    expect(itemImage({ ...base, imageHref: '/api/avatars/buho/image' })).toBe(
      '/api/avatars/buho/image',
    );
    expect(itemImage({ ...base, imageHref: null })).toBeNull();
  });
});
