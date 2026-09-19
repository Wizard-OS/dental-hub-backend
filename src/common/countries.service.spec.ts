import { ServiceUnavailableException } from '@nestjs/common';

import { CountriesService } from './countries.service';

describe('CountriesService', () => {
  const originalApiKey = process.env.REST_COUNTRIES_API_KEY;
  const originalBaseUrl = process.env.REST_COUNTRIES_BASE_URL;
  let service: CountriesService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    process.env.REST_COUNTRIES_API_KEY = 'test-key';
    process.env.REST_COUNTRIES_BASE_URL = 'https://countries.test';
    service = new CountriesService();
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env.REST_COUNTRIES_API_KEY = originalApiKey;
    process.env.REST_COUNTRIES_BASE_URL = originalBaseUrl;
  });

  it('fetches and maps paginated country metadata', async () => {
    fetchSpy.mockResolvedValue(
      buildJsonResponse({
        data: {
          objects: [buildUruguayResponse()],
          meta: { more: false },
        },
      }),
    );

    await expect(service.findAll()).resolves.toEqual([
      expect.objectContaining({
        countryCode: 'UY',
        countryName: 'Uruguay',
        currencyCodes: ['UYU'],
        defaultCurrency: 'UYU',
        callingCodes: ['598'],
        defaultCallingCode: '598',
      }),
    ]);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://countries.test?limit=100&offset=0&response_fields=names.common,codes.alpha_2,currencies,calling_codes,timezones,flag.emoji',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-key' },
      }),
    );
  });

  it('serves stale cache when Rest Countries fails', async () => {
    fetchSpy.mockResolvedValueOnce(
      buildJsonResponse({
        data: {
          objects: [buildUruguayResponse()],
          meta: { more: false },
        },
      }),
    );
    await service.findAll();

    const mutableService = service as unknown as {
      cache: { expiresAt: number };
    };
    mutableService.cache.expiresAt = 0;
    fetchSpy.mockRejectedValueOnce(new Error('network down'));

    await expect(service.findAll()).resolves.toEqual([
      expect.objectContaining({
        countryCode: 'UY',
      }),
    ]);
  });

  it('throws 503 for uncached non-fallback countries when no API key exists', async () => {
    delete process.env.REST_COUNTRIES_API_KEY;

    await expect(service.findByCode('AR')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  function buildJsonResponse(payload: unknown): Response {
    return {
      ok: true,
      json: () => Promise.resolve(payload),
    } as Response;
  }

  function buildUruguayResponse() {
    return {
      names: { common: 'Uruguay' },
      codes: { alpha_2: 'UY' },
      currencies: [{ code: 'UYU' }],
      calling_codes: [{ root: '+5', suffixes: ['98'] }],
      timezones: ['UTC-03:00'],
      flag: { emoji: '\uD83C\uDDFA\uD83C\uDDFE' },
    };
  }
});
