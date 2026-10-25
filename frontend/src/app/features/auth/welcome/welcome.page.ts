import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonRouterLink } from '@ionic/angular';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';

// Bienvenida (P·01): la primera pantalla sin sesión, con el acceso al
// registro y al login
@Component({
  selector: 'app-welcome',
  imports: [IonContent, IonButton, IonRouterLink, RouterLink, AuthLayout],
  templateUrl: './welcome.page.html',
  styleUrl: './welcome.page.scss',
})
export class WelcomePage {}
