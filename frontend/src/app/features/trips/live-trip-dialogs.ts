import { ModalController } from '@ionic/angular';
import { checkmarkCircleOutline } from 'ionicons/icons';
import { Translate } from '../../core/i18n/translate';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { FinishCheck, formatDistance } from './finish-trip.util';
import { PassengerIncidentModal } from './passenger-requests/passenger-incident-modal/passenger-incident-modal';

// En escritorio, reportar y terminar el viaje se piden en una ventana centrada:
// el botón está debajo del mapa y el formulario en la columna de la derecha
// quedaba lejos de él. En el móvil siguen en la hoja (sin ventana encima)

// El formulario de la incidencia en una ventana. true si se envió
export async function openIncidentDialog(
  modalController: ModalController,
  props: { tripId: string; isDriver: boolean },
): Promise<boolean> {
  const modal = await modalController.create({
    component: PassengerIncidentModal,
    componentProps: props,
    // Tan alta como el formulario, como en el detalle de la plaza
    cssClass: 'info-dialog',
  });
  await modal.present();
  const { data } = await modal.onWillDismiss<{ reported?: boolean }>();
  return data?.reported === true;
}

// «¿Terminar el viaje?» en la ventana de confirmación de la guía, con el aviso
// en ámbar si aún está lejos del destino. true si se confirma
export function askFinishTrip(
  confirm: ConfirmService,
  check: FinishCheck,
  translate: Translate,
): Promise<boolean> {
  const isFarWithDistance = check.isFar && check.distance !== null;
  return confirm.ask({
    header: translate('live.terminarViaje'),
    message: isFarWithDistance
      ? `${translate('live.stillFar', { distance: formatDistance(check.distance ?? 0) })} ${translate('live.terminasAhoraTusPasajeros')}`
      : translate('live.dejarasCompartirUbicacionViaje'),
    confirmText: translate(check.isFar ? 'live.finishAnyway' : 'live.terminar'),
    cancelText: translate('live.seguirViaje'),
    isWarning: check.isFar,
    icon: checkmarkCircleOutline,
  });
}
