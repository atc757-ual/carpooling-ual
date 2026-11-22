// La clase que oculta una ventana mientras otra abierta desde ella está
// encima (theme/_components.scss)
export const COVERED_MODAL_CLASS = 'modal-covered';

// Abre una ventana desde un elemento que puede estar dentro de otra (p. ej.
// «Usar mi ubicación» en «Editar búsqueda»): mientras está abierta, la de
// debajo se oculta, para que se vea una sola; vuelve a verse al empezar a
// cerrarse la de encima. Fuera de una ventana, solo la abre
export async function presentOverParent(
  modal: HTMLIonModalElement,
  host: HTMLElement,
): Promise<void> {
  const parent = host.closest('ion-modal');
  if (parent && parent !== modal) {
    parent.classList.add(COVERED_MODAL_CLASS);
    void modal.onWillDismiss().then(() => parent.classList.remove(COVERED_MODAL_CLASS));
  }
  await modal.present();
}
