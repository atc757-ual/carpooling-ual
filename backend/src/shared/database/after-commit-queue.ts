import type { EntityManager, QueryRunner } from 'typeorm';

// Lo que se apunta en la transacción de un cambio y solo se hace si se
// confirma (las push y los correos): si el cambio se deshace, no sale nada.
// Se guarda en los datos del QueryRunner de la transacción, con una clave por
// cola. Quien la usa se suscribe a la DataSource y, en afterTransactionCommit,
// hace lo que take() devuelve (en afterTransactionRollback, lo descarta)
export class AfterCommitQueue<T> {
  constructor(private readonly key: string) {}

  // Lo apunta en la transacción del manager; false si no hay ninguna activa
  // (quien llama decide si lo hace al momento)
  add(manager: EntityManager, item: T): boolean {
    const queryRunner = manager.queryRunner;
    if (!queryRunner?.isTransactionActive) {
      return false;
    }
    const data = queryRunner.data as Record<string, unknown>;
    const pending = (data[this.key] as T[] | undefined) ?? [];
    pending.push(item);
    data[this.key] = pending;
    return true;
  }

  // Lo apuntado en esa transacción, que se vacía
  take(queryRunner: QueryRunner | undefined): T[] {
    if (!queryRunner) {
      return [];
    }
    const data = queryRunner.data as Record<string, unknown>;
    const pending = (data[this.key] as T[] | undefined) ?? [];
    delete data[this.key];
    return pending;
  }
}
