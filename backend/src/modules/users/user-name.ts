// El nombre completo en las consultas (buscar por nombre y apellidos), con
// el alias «user» de la tabla users (TypeORM traduce las propiedades)
export const FULL_NAME_SQL = "concat_ws(' ', user.firstName, user.lastName)";

// Nombre completo (nombre y apellidos): solo para el propio usuario, la
// administración y los correos del sistema. A los demás usuarios se les
// muestra solo el nombre de pila (firstName)
export function fullName(person: {
  firstName: string;
  lastName: string;
}): string {
  return person.lastName
    ? `${person.firstName} ${person.lastName}`
    : person.firstName;
}
