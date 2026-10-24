import request from 'supertest';

// Teléfono válido para los registros de prueba (formato internacional E.164)
export const TEST_PHONE = '+34600123456';

export interface TestAccount {
  name: string;
  email: string;
  password: string;
  // Modos que elige después de registrarse (conductor y/o pasajero)
  profiles: string[];
}

// Alta de un usuario por la API, como lo hará la app: registro público
// (teléfono y aceptación de las normas, sin perfiles) y, con una sesión,
// elección de cada modo (PUT /api/users/me/profiles/{profile}). Devuelve el
// id. Para tener un token con los perfiles, hay que iniciar sesión después
export async function registerUser(
  server: Parameters<typeof request>[0],
  account: TestAccount,
): Promise<string> {
  const registered = await request(server)
    .post('/api/auth/register')
    .send({
      name: account.name,
      email: account.email,
      password: account.password,
      phone: TEST_PHONE,
      acceptedTerms: true,
    })
    .expect(201);
  if (account.profiles.length > 0) {
    const login = await request(server)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);
    const { accessToken } = login.body as { accessToken: string };
    for (const profile of account.profiles) {
      await request(server)
        .put(`/api/users/me/profiles/${profile}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    }
  }
  return (registered.body as { id: string }).id;
}
