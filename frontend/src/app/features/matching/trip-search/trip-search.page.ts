import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

// Buscar (pasajero): la búsqueda de viajes y sus resultados. La cabecera
// («Buscar viaje», con la flecha de volver en el móvil) la pone la pestaña con
// el data de la ruta
@Component({
  selector: 'app-trip-search',
  imports: [IonContent],
  templateUrl: './trip-search.page.html',
  styleUrls: ['../../tabs/tab-page.scss'],
})
export class TripSearchPage {}
