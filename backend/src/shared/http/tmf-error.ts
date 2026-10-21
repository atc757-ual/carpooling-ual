// Cuerpo de una respuesta de error según TMF630 (TM Forum REST API Design
// Guidelines). status va como texto, tal como lo define la norma
export interface TmfError {
  '@type': 'Error';
  code: string;
  reason: string;
  message: string;
  status: string;
}

export interface TmfFieldError {
  field: string;
  reason: string;
}

// Extensión de Error para los datos de entrada no válidos: TMF630 permite
// tipos derivados indicando el tipo base en @baseType
export interface TmfValidationError extends Omit<TmfError, '@type'> {
  '@type': 'ValidationError';
  '@baseType': 'Error';
  fields: TmfFieldError[];
}
