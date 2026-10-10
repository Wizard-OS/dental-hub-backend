import type catalog from '../../i18n/en/api.json';

export type ApiMessageKey =
  | `api.messages.${keyof typeof catalog.messages}`
  | `api.http.${keyof typeof catalog.http}`
  | `api.drive.${keyof typeof catalog.drive}`;

export type ApiMessageArguments = Readonly<Record<string, string | number>>;

/** An internal message reference, rendered to a string at the HTTP boundary. */
export class ApiMessage {
  constructor(
    readonly key: ApiMessageKey,
    readonly args: ApiMessageArguments = {},
  ) {}

  get message(): string {
    return this.key;
  }
}

export function apiMessage(
  key: ApiMessageKey,
  args?: ApiMessageArguments,
): ApiMessage {
  return new ApiMessage(key, args);
}
