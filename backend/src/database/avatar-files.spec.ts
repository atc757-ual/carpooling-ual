import { checkAvatarImage } from '../modules/users/avatar-image';
import { parseAvatarFileName, readDefaultAvatars } from './avatar-files';

describe('avatar files', () => {
  it('takes the order, the name and the key from the file name', () => {
    expect(
      parseAvatarFileName(
        'Avatar 13 · Mujer · recogido, corbata y gafas · frontal.png',
      ),
    ).toEqual({
      key: 'recogido-corbata-y-gafas',
      name: 'Recogido, corbata y gafas',
      sortOrder: 13,
    });
  });

  it('removes the accents only from the key', () => {
    expect(
      parseAvatarFileName('Avatar 10 · Hombre · cabello castaño · frontal.png'),
    ).toMatchObject({ key: 'cabello-castano', name: 'Cabello castaño' });
  });

  it('rejects a file name without the expected parts', () => {
    expect(() => parseAvatarFileName('buho.png')).toThrow('buho.png');
  });

  describe('the files of the platform', () => {
    const avatars = readDefaultAvatars();

    it('are 28, in order and with different keys', () => {
      expect(avatars.map(({ sortOrder }) => sortOrder)).toEqual(
        Array.from({ length: 28 }, (_, index) => index + 1),
      );
      expect(new Set(avatars.map(({ key }) => key)).size).toBe(28);
    });

    it('pass the same check as an uploaded image', () => {
      for (const { image } of avatars) {
        expect(checkAvatarImage(image)).toBe('image/png');
      }
    });
  });
});
