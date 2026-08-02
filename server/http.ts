import type { DataStatus } from './contracts.js';

export interface EnvelopeOptions {
  provider?: string;
  dataStatus?: DataStatus;
  fallbackUsed?: boolean;
  warnings?: string[];
  errors?: string[];
  status?: number;
}

export function envelope<T>(data: T, options: EnvelopeOptions = {}): Response {
  const requestId = crypto.randomUUID();
  return Response.json({
    data,
    meta: {
      request_id: requestId,
      provider: options.provider ?? 'VercelFunction',
      data_status: options.dataStatus ?? 'provisional',
      fallback_used: options.fallbackUsed ?? false,
      generated_at: new Date().toISOString(),
    },
    warnings: options.warnings ?? [],
    errors: options.errors ?? [],
  }, { status: options.status ?? 200, headers: { 'x-correlation-id': requestId } });
}

export async function body<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new Error('Content-Type은 application/json이어야 합니다.');
  return request.json() as Promise<T>;
}

export function badRequest(message: string): Response {
  return envelope(null, { status: 400, errors: [message] });
}
