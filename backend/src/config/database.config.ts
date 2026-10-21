import { TypeOrmModuleOptions } from '@nestjs/typeorm';

// Opciones de conexión de TypeORM con PostgreSQL + PostGIS.
// Están en una función aparte para poder probarlas y para reutilizarlas
// en la herramienta de migraciones (paso 4), sin repetir la configuración.
export function buildTypeOrmOptions(databaseUrl: string): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    // Cada módulo registra sus propias entidades con TypeOrmModule.forFeature(),
    // así ningún módulo tiene que conocer las entidades de los demás
    autoLoadEntities: true,
    // TypeORM nunca modifica el esquema por su cuenta: los cambios en la base
    // de datos se hacen solo con migraciones versionadas en Git
    synchronize: false,
  };
}
