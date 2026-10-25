// Rutas a las que redirigen los guards y el interceptor. Las pantallas se
// añaden en features/ (p. ej. features/auth/login/login.page.ts)
export const LOGIN_PATH = '/auth/login';
export const WELCOME_PATH = '/auth/welcome';
export const HOME_PATH = '/';

// Parámetro con la página que se pedía, para volver a ella tras el login
export const RETURN_URL_PARAM = 'returnUrl';
