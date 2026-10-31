// Rutas a las que redirigen los guards y el interceptor. Las pantallas se
// añaden en features/ (p. ej. features/auth/login/login.page.ts)
export const LOGIN_PATH = '/auth/login';
export const WELCOME_PATH = '/auth/welcome';
// Final del registro: la abre la verificación del correo, con la sesión ya abierta
export const ACCOUNT_CREATED_PATH = '/account-created';
// Área con sesión: abre Publicar al entrar
export const HOME_PATH = '/tabs';
// Ruta de la pestaña Buscar, usada por sus enlaces directos
export const SEARCH_PATH = '/tabs/search';
export const PROFILE_PATH = '/tabs/profile';

// Parámetro con la página que se pedía, para volver a ella tras el login
export const RETURN_URL_PARAM = 'returnUrl';
