// Rutas a las que redirigen los guards y el interceptor. Las pantallas se
// añaden en features/ (p. ej. features/auth/login/login.page.ts)
export const LOGIN_PATH = '/auth/login';
export const WELCOME_PATH = '/auth/welcome';
// Inicio: la primera pestaña del área con sesión
export const HOME_PATH = '/tabs/home';
// Elegir modo (pasajero, conductor o ambos) tras verificar el correo
export const MODES_PATH = '/modes';

// Parámetro con la página que se pedía, para volver a ella tras el login
export const RETURN_URL_PARAM = 'returnUrl';
