import { Component, computed, inject, input, resource } from '@angular/core';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { AvatarArt } from '../../../shared/components/ui/avatar-art/avatar-art';

@Component({
  selector: 'app-conversation-avatar',
  imports: [AvatarArt],
  templateUrl: './conversation-avatar.html',
  styleUrl: './conversation-avatar.scss',
})
export class ConversationAvatar {
  readonly name = input('');
  readonly avatarKey = input<string | null>(null);

  private readonly avatars = inject(AvatarsService);
  readonly initials = computed(() =>
    this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toLocaleUpperCase())
      .join(''),
  );
  readonly art = resource({
    params: () => this.avatarKey() ?? undefined,
    loader: ({ params }) => this.avatars.getGraphic(params),
  });
}
