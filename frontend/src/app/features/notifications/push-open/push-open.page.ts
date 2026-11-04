import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ActiveModeService } from '../../../core/services/users/active-mode.service';
import { openNotificationTarget } from '../notification-target';

// Página de paso al pulsar una push con la app cerrada: el service worker la
// abre con los datos de la push (/tabs/push-open?type=…&tripId=…) y lleva a su
// pantalla, sin quedarse en el historial
@Component({
  selector: 'app-push-open',
  imports: [IonContent, IonSpinner],
  template: `
    <ion-content>
      <div class="push-open">
        <ion-spinner name="crescent" aria-label="Abriendo el aviso" />
      </div>
    </ion-content>
  `,
  styles: `
    .push-open {
      display: flex;
      justify-content: center;
      padding: var(--space-xl);
    }
  `,
})
export class PushOpenPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly activeMode = inject(ActiveModeService);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    void openNotificationTarget(
      { router: this.router, auth: this.auth, activeMode: this.activeMode },
      {
        type: params.get('type') ?? '',
        tripId: params.get('tripId') ?? undefined,
        requestId: params.get('requestId') ?? undefined,
      },
      true,
    );
  }
}
