// Si el sistema pide reducir el movimiento (prefers-reduced-motion)
export function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// El desplazamiento de scrollBy y scrollTo: suave, salvo que el sistema pida
// reducir el movimiento, que entonces salta (WCAG 2.3.3)
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
