// Traduce una clave con sus parámetros. Lo reciben las funciones puras que
// componen textos (p. ej. el de compartir el viaje), para no depender de
// Transloco y probarse solas: en la app, `(key, params) => transloco.translate(key, params)`
export type Translate = (key: string, params?: Record<string, unknown>) => string;
