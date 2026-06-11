import { qualityToModel, supportedStyles, type PolishQuality, type PolishStyle } from "../src/polish-options.js";

type BenchmarkRow = {
  quality: PolishQuality;
  model: string;
  runs: number;
  success: number;
  failures: number;
  p50Ms?: number;
  p90Ms?: number;
  avgMs?: number;
};

const endpoint = process.env.POLISH_BENCHMARK_URL ?? "http://localhost:3000/polish";
const token = process.env.API_TOKEN;
const iterations = readPositiveInt(process.env.POLISH_BENCHMARK_ITERATIONS, 5);
const style = readStyle(process.env.POLISH_BENCHMARK_STYLE ?? "professional");
const qualities = readQualities(process.env.POLISH_BENCHMARK_QUALITIES ?? "cheap,balanced,quality");
const text =
  process.env.POLISH_BENCHMARK_TEXT ??
  "I check this issue and backend not return data yet, maybe frontend need wait for API update.";

if (!token) {
  console.error("API_TOKEN is required for benchmark requests.");
  process.exit(1);
}

const rows: BenchmarkRow[] = [];

for (const quality of qualities) {
  const durations: number[] = [];
  let failures = 0;

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Token": token,
        },
        body: JSON.stringify({
          text,
          style,
          quality,
        }),
      });

      if (!response.ok) {
        failures += 1;
        const errorText = await response.text();
        console.error(`${quality} run ${index + 1} failed: HTTP ${response.status} ${errorText}`);
        continue;
      }

      await response.json();
      durations.push(Math.round(performance.now() - startedAt));
    } catch (error) {
      failures += 1;
      console.error(`${quality} run ${index + 1} failed:`, error instanceof Error ? error.message : error);
    }
  }

  rows.push({
    quality,
    model: qualityToModel[quality],
    runs: iterations,
    success: durations.length,
    failures,
    p50Ms: percentile(durations, 50),
    p90Ms: percentile(durations, 90),
    avgMs: average(durations),
  });
}

console.table(rows);

if (rows.every((row) => row.success === 0)) {
  process.exitCode = 1;
}

function readStyle(value: string): PolishStyle {
  if (supportedStyles.includes(value as PolishStyle)) {
    return value as PolishStyle;
  }

  throw new Error(`POLISH_BENCHMARK_STYLE must be one of: ${supportedStyles.join(", ")}`);
}

function readQualities(value: string): PolishQuality[] {
  const qualities = value
    .split(",")
    .map((quality) => quality.trim())
    .filter(Boolean);

  for (const quality of qualities) {
    if (!(quality in qualityToModel)) {
      throw new Error(`POLISH_BENCHMARK_QUALITIES includes unsupported quality: ${quality}`);
    }
  }

  return qualities as PolishQuality[];
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function average(values: number[]) {
  if (values.length === 0) {
    return undefined;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
