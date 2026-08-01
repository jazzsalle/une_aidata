type RuntimeProcess = { env: Record<string, string | undefined> };
const runtime = globalThis as typeof globalThis & { process?: RuntimeProcess };
export function env(name: string): string | undefined {
  const value = runtime.process?.env?.[name];
  return value?.trim() || undefined;
}
export function dataMode(): 'live' | 'hybrid' | 'scenario' {
  const mode = env('POC_DATA_MODE');
  return mode === 'live' || mode === 'scenario' ? mode : 'hybrid';
}
