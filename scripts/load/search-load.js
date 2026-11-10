// Prueba de carga de RNF-01 y RNF-07 con k6 (imagen Docker grafana/k6, sin
// dependencias npm). Pasos y resultados en docs/pruebas-carga.md.
//
// Tres escenarios a la vez durante DURATION (5 min por defecto):
//   - search: 50 usuarios virtuales (VUS) buscan viaje al campus, cada uno con
//     su cuenta de pasajero y una pausa de 1 s entre búsquedas.
//     RNF-01: p95 de POST /trips/search < 2 s y menos de un 1 % de errores.
//   - events: 10 conductores cambian de modo cada 2 s (unos 5 eventos/s), para
//     que el Gemelo Digital tenga eventos que sincronizar durante la carga.
//   - twin: cada 10 s lee el estado del gemelo como administrador y guarda su
//     retraso p95 (lag.p95Ms, sobre los últimos 500 eventos).
//     RNF-07: p95 ≤ 1 s entre el evento y el gemelo, con esa carga.
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://host.docker.internal:3000/api";
const DURATION = __ENV.DURATION || "5m";
const VUS = Number(__ENV.VUS || 50);
const DRIVERS = 10;
const PASSWORD = "carpooling";
const JSON_HEADERS = { "Content-Type": "application/json" };

const twinLagP95 = new Trend("twin_lag_p95_ms");

export const options = {
  scenarios: {
    search: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
      exec: "search",
    },
    events: {
      executor: "constant-vus",
      vus: DRIVERS,
      duration: DURATION,
      exec: "switchMode",
    },
    twin: {
      executor: "constant-vus",
      vus: 1,
      duration: DURATION,
      exec: "sampleTwin",
    },
  },
  thresholds: {
    "http_req_duration{scenario:search}": ["p(95)<2000"],
    "http_req_failed{scenario:search}": ["rate<0.01"],
    twin_lag_p95_ms: ["max<=1000"],
  },
};

function login(email) {
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password: PASSWORD }),
    {
      headers: JSON_HEADERS,
    },
  );
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status}`);
  }
  return response.json("accessToken");
}

function pad(value, length) {
  return String(value).padStart(length, "0");
}

// Las cuentas de load-data.sql, una sesión por usuario virtual
export function setup() {
  const passengers = [];
  for (let n = 1; n <= VUS; n++) {
    passengers.push(login(`load-passenger-${pad(n, 2)}@ual.es`));
  }
  const drivers = [];
  for (let n = 1; n <= DRIVERS; n++) {
    drivers.push(login(`load-driver-${pad(n, 3)}@ual.es`));
  }
  return { passengers, drivers, admin: login("admin@ual.es") };
}

function auth(token) {
  return { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } };
}

// Mañana a las 07:30 UTC: las 08:30 en Almería en invierno, dentro de la franja
// de salidas de los viajes de carga (07:30 a 09:30)
function desiredAt() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(7, 30, 0, 0);
  return date.toISOString();
}

export function search(data) {
  const token = data.passengers[(__VU - 1) % data.passengers.length];
  const body = {
    place: {
      type: "Point",
      coordinates: [-2.75 + Math.random() * 0.6, 36.7 + Math.random() * 0.3],
    },
    parkingId: "p1",
    direction: "to-campus",
    desiredAt: desiredAt(),
  };
  const response = http.post(
    `${BASE_URL}/trips/search`,
    JSON.stringify(body),
    auth(token),
  );
  check(response, { "search answers 200": (r) => r.status === 200 });
  sleep(1);
}

const modes = {};

export function switchMode(data) {
  const token = data.drivers[(__VU - 1) % data.drivers.length];
  modes[__VU] = modes[__VU] === "driver" ? "passenger" : "driver";
  const response = http.put(
    `${BASE_URL}/users/me/active-mode`,
    JSON.stringify({ mode: modes[__VU] }),
    auth(token),
  );
  check(response, { "mode changes": (r) => r.status === 200 });
  sleep(2);
}

export function sampleTwin(data) {
  const response = http.get(`${BASE_URL}/admin/digital-twin`, auth(data.admin));
  const p95 = response.status === 200 ? response.json("lag.p95Ms") : null;
  if (typeof p95 === "number") {
    twinLagP95.add(p95);
  }
  sleep(10);
}
