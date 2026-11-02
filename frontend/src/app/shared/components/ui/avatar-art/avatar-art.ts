import { Component, input } from '@angular/core';
import { AvatarGraphic } from '../../../../core/models/avatar.model';

// El dibujo de un avatar del catálogo: los nodos SVG de sus formas (ya
// validadas por AvatarsService) o la imagen subida por el panel. Ocupa todo
// el componente; el tamaño lo da quien lo usa con su clase (p. ej. 32px en el
// selector del Perfil)
@Component({
  selector: 'app-avatar-art',
  templateUrl: './avatar-art.html',
  styleUrl: './avatar-art.scss',
})
export class AvatarArt {
  readonly graphic = input.required<AvatarGraphic>();
}
