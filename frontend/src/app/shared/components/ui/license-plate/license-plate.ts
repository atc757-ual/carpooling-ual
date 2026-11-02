import { Component, input } from '@angular/core';

// Las 12 estrellas de la franja de la UE, en círculo (coordenadas del SVG)
const STAR_RING_RADIUS = 3.4;
const STARS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6;
  return {
    x: 6 + STAR_RING_RADIUS * Math.sin(angle),
    y: 8 - STAR_RING_RADIUS * Math.cos(angle),
  };
});

// Matrícula dibujada como la de un coche (guía, «Vehículo»): placa blanca con
// borde, la franja azul de la UE con las estrellas y la letra del país, y el
// número en negro. Igual en modo claro y oscuro, como una placa de verdad.
// Los lectores de pantalla leen solo «Matrícula 1234 BCD»
@Component({
  selector: 'app-license-plate',
  templateUrl: './license-plate.html',
  styleUrl: './license-plate.scss',
})
export class LicensePlate {
  // Ya con el formato de mostrar («1234 BCD»)
  readonly plate = input.required<string>();
  // La letra del país en la franja (España: E)
  readonly country = input('E');

  protected readonly stars = STARS;
}
