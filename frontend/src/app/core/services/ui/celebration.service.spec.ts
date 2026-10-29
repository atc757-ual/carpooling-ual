import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CelebrationService } from './celebration.service';

const { confetti } = vi.hoisted(() => ({ confetti: vi.fn().mockResolvedValue(undefined) }));
vi.mock('canvas-confetti', () => ({ default: confetti }));

describe('CelebrationService', () => {
  it('throws green confetti, unless the system asks for less motion', async () => {
    document.documentElement.style.setProperty('--color-eco', '#2ecc8f');

    await TestBed.inject(CelebrationService).celebrate();

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ colors: ['#2ecc8f'], disableForReducedMotion: true }),
    );
  });
});
