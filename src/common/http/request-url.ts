import type { Request } from 'express';

export function buildRequestBaseUrl(request: Request): string {
  return `${request.protocol}://${request.get('host')}`;
}
