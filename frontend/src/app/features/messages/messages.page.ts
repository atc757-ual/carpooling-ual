import { Component } from '@angular/core';
import { IonCard, IonCardContent, IonContent, IonIcon } from '@ionic/angular';
import { chatbubblesOutline } from 'ionicons/icons';

// Mensajes entre quien conduce y quien viaja en el mismo viaje. De momento,
// solo el destino del menú: la mensajería llegará en su PR (requisito por
// validar, ver pendientes-memoria.md)
@Component({
  selector: 'app-messages',
  imports: [IonCard, IonCardContent, IonContent, IonIcon],
  templateUrl: './messages.page.html',
  styleUrls: ['../tabs/tab-page.scss', './messages.page.scss'],
})
export class MessagesPage {
  protected readonly icon = chatbubblesOutline;
}
