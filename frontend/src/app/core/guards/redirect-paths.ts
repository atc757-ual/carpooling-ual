// Rutas a las que redirigen los guards y el interceptor. Las pantallas se
// añaden en features/ (p. ej. features/auth/login/login.page.ts)
export const LOGIN_PATH = '/auth/login';
export const WELCOME_PATH = '/auth/welcome';
// Área con sesión: abre Buscar o Publicar (lo último que se hizo)
export const HOME_PATH = '/tabs';
// Adonde lleva HOME_PATH sin modo guardado (p. ej. al abrir la app sin sesión)
export const SEARCH_PATH = '/tabs/search';
export const PROFILE_PATH = '/tabs/profile';

// Parámetro con la página que se pedía, para volver a ella tras el login
export const RETURN_URL_PARAM = 'returnUrl';
