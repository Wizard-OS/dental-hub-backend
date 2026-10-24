import type { Request } from 'express';

const API_PATH_SUFFIX = /\/api\/?$/i;

export function buildRequestBaseUrl(request: Request): string {
  const configuredApiUrl = process.env.HOST_API?.trim();

  if (configuredApiUrl) {
    try {
      const url = new URL(configuredApiUrl);
      const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
      const hasNoCredentials = !url.username && !url.password;
      const hasNoQueryOrFragment = !url.search && !url.hash;
      const isSecureProductionUrl =
        process.env.NODE_ENV !== 'production' || url.protocol === 'https:';

      if (
        isHttp &&
        hasNoCredentials &&
        hasNoQueryOrFragment &&
        isSecureProductionUrl
      ) {
        const pathname = url.pathname.replace(API_PATH_SUFFIX, '');

        return `${url.origin}${pathname === '/' ? '' : pathname}`.replace(
          /\/$/,
          '',
        );
      }
    } catch {
      // A malformed public URL is ignored; production URLs below remain relative.
    }
  }

  if (process.env.NODE_ENV === 'production') return '';

  return `${request.protocol}://${request.get('host')}`;
}
