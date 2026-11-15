import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonCheckbox } from '@ionic/angular';
import { SeatStepper } from '../../../shared/components/ui/seat-stepper/seat-stepper';
import { FROM_CAMPUS, TO_CAMPUS } from '../trip-way';

// Plazas de un viaje de ida y vuelta (Publicar, paso Vehículo): por defecto,
// «Mismo número de plazas en la ida y la vuelta» marcada y un solo selector;
// desmarcada, la ida y la vuelta lado a lado, cada una con su icono. Mientras
// está marcada, la vuelta lleva las plazas de la ida
@Component({
  selector: 'app-round-trip-seats',
  imports: [ReactiveFormsModule, IonCheckbox, SeatStepper],
  templateUrl: './round-trip-seats.html',
  styleUrl: './round-trip-seats.scss',
})
export class RoundTripSeats implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly seats = input.required<FormControl<number>>();
  readonly returnSeats = input.required<FormControl<number>>();
  readonly max = input(1);

  readonly isSame = signal(true);

  protected readonly toCampusIcon = TO_CAMPUS.icon;
  protected readonly fromCampusIcon = FROM_CAMPUS.icon;

  ngOnInit(): void {
    // Al volver a este paso, sigue como se dejó: distintas si ya lo eran
    this.isSame.set(this.returnSeats().value === this.seats().value);
    this.seats()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (this.isSame()) this.returnSeats().setValue(value);
      });
  }

  handleSameChange(isSame: boolean): void {
    this.isSame.set(isSame);
    if (isSame) this.returnSeats().setValue(this.seats().value);
  }
}
