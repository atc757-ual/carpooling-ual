// Rutas a las que redirigen los guards y el interceptor. Las pantallas se
// añaden en features/ (p. ej. features/auth/login/login.page.ts)
export const LOGIN_PATH = '/auth/login';
export const WELCOME_PATH = '/auth/welcome';
// Final del registro: la abre la verificación del correo, con la sesión ya abierta
export const ACCOUNT_CREATED_PATH = '/account-created';
// Área con sesión: abre Buscar al entrar (Publicar si solo es conductor)
export const HOME_PATH = '/tabs';
// La pestaña Publicar (adonde lleva HOME_PATH si solo es conductor)
export const PUBLISH_PATH = '/tabs/publish';
// Adonde lleva HOME_PATH (con perfil de pasajero): la pestaña Buscar
export const SEARCH_PATH = '/tabs/search';
export const PROFILE_PATH = '/tabs/profile';
// Panel de administración (solo con el perfil de administrador)
export const ADMIN_PATH = '/admin';

// Parámetro con la página que se pedía, para volver a ella tras el login
export const RETURN_URL_PARAM = 'returnUrl';
