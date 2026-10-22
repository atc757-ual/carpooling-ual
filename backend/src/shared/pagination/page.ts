// Paginación de listas (TMF630: ?offset=&limit=). Los services reciben qué
// trozo se pide y devuelven ese trozo junto con el total, que la capa API
// envía en las cabeceras X-Total-Count y X-Result-Count
export interface PageRequest {
  offset: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  total: number;
}
