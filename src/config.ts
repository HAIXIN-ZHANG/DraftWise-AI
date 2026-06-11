const defaultPort = 3000;
const requiredConfigKeys = ["API_TOKEN", "OPENAI_API_KEY"] as const;

export type RequiredConfigKey = (typeof requiredConfigKeys)[number];

export function getPort() {
  const rawPort = readOptionalEnv("PORT");

  if (!rawPort) {
    return defaultPort;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

export function getApiToken() {
  return readOptionalEnv("API_TOKEN");
}

export function getOpenAIApiKey() {
  return readOptionalEnv("OPENAI_API_KEY");
}

export function getMissingRuntimeConfig(): RequiredConfigKey[] {
  return requiredConfigKeys.filter((key) => !readOptionalEnv(key));
}

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}
