// La clave de un elemento de catálogo: su nombre sin tildes, en minúsculas y
// con guiones («Lynk & Co» → «lynk-co»). No cambia aunque cambie el nombre
export function toCatalogKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
