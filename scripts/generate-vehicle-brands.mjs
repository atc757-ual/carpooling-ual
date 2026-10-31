import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'frontend/src/app/shared/utils/vehicle-brands.ts');
const SOURCE =
  'https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json';

// Marcas comercializadas en España; la lista blanca también cubre las ausentes de vPIC.
const BRANDS = [
  'Abarth', 'Aiways', 'Alfa Romeo', 'Alpine', 'Aston Martin', 'Audi', 'Bentley', 'BMW',
  'BYD', 'Cadillac', 'Changan', 'Chevrolet', 'Citroën', 'Cupra', 'Dacia', 'Daewoo',
  'DFSK', 'Dodge', 'Dongfeng', 'DR', 'DS', 'Ebro', 'Ferrari', 'Fiat', 'Ford', 'Genesis',
  'Honda', 'Hyundai', 'Ineos', 'Infiniti', 'Isuzu', 'Jaguar', 'Jeep', 'KGM', 'Kia',
  'Lamborghini', 'Lancia', 'Land Rover', 'Leapmotor', 'Lexus', 'Ligier', 'Lynk & Co',
  'Maserati', 'Mazda', 'Mercedes-Benz', 'MG', 'MINI', 'Mitsubishi', 'Nissan', 'Omoda',
  'Opel', 'Peugeot', 'Polestar', 'Porsche', 'Renault', 'Rolls-Royce', 'SEAT', 'Seres',
  'Škoda', 'Smart', 'SsangYong', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Volkswagen',
  'Volvo', 'XPeng', 'Zeekr',
];

const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const byNormalized = new Map(BRANDS.map((brand) => [normalize(brand), brand]));
const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`NHTSA vPIC returned ${response.status}`);
}
const data = await response.json();
const discovered = data.Results.map(({ MakeName }) => byNormalized.get(normalize(MakeName)))
  .filter(Boolean);
const brands = [...new Set([...BRANDS, ...discovered])].sort((a, b) => a.localeCompare(b, 'es'));
const output = `// Marcas habituales en España, contrastadas con NHTSA vPIC y completadas con la lista local.\n// Regenerar: node scripts/generate-vehicle-brands.mjs (la app nunca consulta NHTSA).\nexport const VEHICLE_BRANDS: readonly string[] = ${JSON.stringify(brands, null, 2)};\n`;
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, output, 'utf8');
