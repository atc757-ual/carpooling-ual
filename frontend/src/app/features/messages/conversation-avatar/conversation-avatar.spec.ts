import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { ConversationAvatar } from './conversation-avatar';

describe('ConversationAvatar', () => {
  const getGraphic = vi.fn();
  let fixture: ComponentFixture<ConversationAvatar>;

  async function render(name: string, avatarKey: string | null = null): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [ConversationAvatar],
      providers: [{ provide: AvatarsService, useValue: { getGraphic } }],
    });
    fixture = TestBed.createComponent(ConversationAvatar);
    fixture.componentRef.setInput('name', name);
    fixture.componentRef.setInput('avatarKey', avatarKey);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => getGraphic.mockReset());

  it('shows the initials of the first two words without an avatar', async () => {
    const root = await render('  lucía   martín garcía ');

    expect(root.querySelector('.conversation-avatar')?.textContent?.trim()).toBe('LM');
    expect(root.querySelector('app-avatar-art')).toBeNull();
    expect(getGraphic).not.toHaveBeenCalled();
  });

  it('shows the chosen avatar instead of the initials', async () => {
    getGraphic.mockResolvedValue({ kind: 'image', src: '/api/avatars/sun.png' });
    const root = await render('Lucía Martín', 'sun');

    expect(getGraphic).toHaveBeenCalledWith('sun');
    expect(root.querySelector('app-avatar-art img')?.getAttribute('src')).toBe(
      '/api/avatars/sun.png',
    );
    expect(root.querySelector('.conversation-avatar')?.textContent?.trim()).toBe('');
  });

  it('keeps the initials when the avatar is not in the catalog', async () => {
    getGraphic.mockResolvedValue(null);
    const root = await render('Pía', 'gone');

    expect(root.querySelector('.conversation-avatar')?.textContent?.trim()).toBe('P');
  });

  it('is hidden from screen readers: the name is read next to it', async () => {
    const root = await render('Pía');

    expect(root.querySelector('.conversation-avatar')?.getAttribute('aria-hidden')).toBe('true');
  });
});
