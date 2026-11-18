// Auditoría de dependencias del CI (sustituye a `npm audit --audit-level=high`).
//
// Uso, desde la carpeta del proyecto: node ../scripts/audit-check.mjs <backend|frontend>
//
// Ejecuta `npm audit --omit=dev --json` y falla, igual que antes, con cualquier
// aviso de gravedad alta o crítica. La única diferencia es ALLOWED_ADVISORIES:
// una lista de excepciones pensada para que NO sea una puerta abierta. Una
// excepción solo vale para un aviso concreto (su GHSA), de un paquete concreto,
// en un proyecto concreto y con el rango de versiones afectado tal como estaba
// cuando se revisó, y además caduca. El CI vuelve a fallar si:
//   - aparece cualquier otro aviso alto o crítico (aunque sea del mismo paquete);
//   - llega la fecha de revisión (reviewBy) de una excepción;
//   - el aviso cambia de rango (lo normal es que haya salido una versión que lo
//     arregla) o npm ofrece ya un arreglo compatible (sin salto major);
//   - una excepción ya no hace falta (el aviso no sale en el informe): se quita.
// Así, una excepción no deja pasar nada que no se haya revisado a mano, y cada
// cambio en esta lista pasa por un PR (el fichero está en los `paths` de los
// workflows de backend y frontend, que se relanzan al tocarlo).
//
// Para añadir una excepción hace falta: que no exista arreglo seguro, que el
// fallo no se pueda explotar en nuestro uso (explicarlo en `reason`) y una
// fecha de revisión de, como mucho, un mes.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

export const ALLOWED_ADVISORIES = [
  {
    id: 'GHSA-fc5q-39xc-vjpf',
    project: 'backend',
    packageName: 'picomatch',
    range: '<=4.0.7',
    // Por qué se permite (revisado el 18/11/2026):
    // - Es un ReDoS: un patrón glob con extglobs repetidos («+(a|a)…») bloquea
    //   la CPU. Solo se puede explotar si el atacante elige el patrón.
    // - Nos llega por typeorm → tinyglobby → fdir → picomatch. TypeORM solo lo
    //   usa para cargar clases de una carpeta (DirectoryExportedClassesLoader),
    //   con los patrones fijos de entidades y migraciones de
    //   src/database/data-source.ts (comandos de migración y seed). La API ni
    //   siquiera pasa por ahí: usa autoLoadEntities (src/config/database.config.ts).
    //   Ningún dato de un usuario llega a un glob.
    // - No hay versión que lo arregle: GitHub da first_patched_version = null
    //   y la última de picomatch es la 4.0.7. El único arreglo que propone npm
    //   es bajar typeorm a la 0.3.31, un salto major hacia atrás que rompe el
    //   backend.
    // - El aviso existe desde el 19/10/2026, pero GitHub no lo revisó hasta el
    //   17/11/2026: desde ese día `npm audit` falla en todas las ramas sin que
    //   haya cambiado ninguna dependencia.
    // Cuándo se quita: en cuanto salga una versión de picomatch que lo arregle
    // (Dependabot la propondrá en su revisión semanal y este script fallará
    // porque cambia el rango o porque deja de salir el aviso). Si para el 18/12
    // aún no ha salido, se revisa de nuevo: si sigue sin arreglo y sin riesgo,
    // se renueva la fecha un mes más en un PR propio.
    reason:
      'ReDoS only with attacker-controlled glob patterns; typeorm uses fixed config globs; no patched version',
    reviewBy: '2026-12-18',
  },
];

// El GHSA de un aviso, sacado de su enlace (https://github.com/advisories/GHSA-…)
function advisoryId(url) {
  return url?.split('/').pop() ?? '';
}

// Los avisos del informe: cada objeto de `via` (los textos de `via` son
// paquetes que solo dependen de otro vulnerable, no avisos nuevos)
export function listAdvisories(report) {
  const advisories = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via) {
      if (typeof via !== 'object') {
        continue;
      }
      const id = advisoryId(via.url);
      advisories.set(`${id}:${via.name}`, {
        id,
        packageName: via.name,
        severity: via.severity,
        range: via.range,
        title: via.title,
        fixAvailable: report.vulnerabilities[via.name]?.fixAvailable ?? false,
      });
    }
  }
  return [...advisories.values()];
}

// Hay arreglo seguro si npm puede actualizar sin un salto major
function hasSafeFix(fixAvailable) {
  return fixAvailable === true || (typeof fixAvailable === 'object' && !fixAvailable.isSemVerMajor);
}

// Lo que impide pasar la auditoría (vacío si pasa) y las excepciones aplicadas
export function checkAudit({ report, project, today, allowlist = ALLOWED_ADVISORIES }) {
  if (!report || typeof report.vulnerabilities !== 'object') {
    return {
      problems: [`npm audit did not return a report: ${JSON.stringify(report?.error ?? report)}`],
      allowed: [],
    };
  }
  const entries = allowlist.filter((entry) => entry.project === project);
  const blocking = listAdvisories(report).filter(({ severity }) =>
    BLOCKING_SEVERITIES.has(severity),
  );
  const problems = [];
  const allowed = [];

  for (const advisory of blocking) {
    const entry = entries.find(
      (candidate) => candidate.id === advisory.id && candidate.packageName === advisory.packageName,
    );
    const label = `${advisory.id} (${advisory.packageName} ${advisory.range}, ${advisory.severity}): ${advisory.title}`;
    if (!entry) {
      problems.push(`Not allowed: ${label}`);
    } else if (entry.reviewBy < today) {
      problems.push(`Exception expired on ${entry.reviewBy}, review it: ${label}`);
    } else if (entry.range !== advisory.range) {
      problems.push(
        `Advisory changed from ${entry.range} to ${advisory.range} (a fix may exist), review it: ${label}`,
      );
    } else if (hasSafeFix(advisory.fixAvailable)) {
      problems.push(`A compatible fix exists, apply it with npm audit fix: ${label}`);
    } else {
      allowed.push(`${label} (until ${entry.reviewBy})`);
    }
  }

  for (const entry of entries) {
    const isStillReported = blocking.some(
      ({ id, packageName }) => id === entry.id && packageName === entry.packageName,
    );
    if (!isStillReported) {
      problems.push(
        `Exception no longer needed, remove it from scripts/audit-check.mjs: ${entry.id} (${entry.packageName})`,
      );
    }
  }
  return { problems, allowed };
}

const NPM_AUDIT = 'npm audit --omit=dev --json';

function runNpmAudit() {
  const options = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  // En Windows npm es un .cmd y necesita la shell (orden fija, sin datos de fuera)
  const result =
    process.platform === 'win32'
      ? spawnSync(NPM_AUDIT, { ...options, shell: true })
      : spawnSync('npm', NPM_AUDIT.split(' ').slice(1), options);
  // npm audit sale con 1 cuando hay avisos: eso no es un error al ejecutarlo
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error(`npm audit failed: ${result.error?.message ?? result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function main() {
  const project = process.argv[2];
  if (!['backend', 'frontend'].includes(project)) {
    console.error('Usage: node ../scripts/audit-check.mjs <backend|frontend>');
    process.exit(2);
  }
  const today = new Date().toISOString().slice(0, 10);
  const { problems, allowed } = checkAudit({ report: runNpmAudit(), project, today });
  // Las excepciones se ven en cada ejecución (anotación de GitHub Actions)
  for (const line of allowed) {
    console.log(`::warning title=Allowed advisory::${line}`);
  }
  if (problems.length > 0) {
    for (const line of problems) {
      console.error(`::error title=npm audit::${line}`);
    }
    process.exit(1);
  }
  console.log(`npm audit: no high or critical advisories pending (${allowed.length} allowed).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
