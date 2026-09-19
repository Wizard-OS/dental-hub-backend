import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { getEnv } from '../config/env';
import { CountryMetadata } from './interfaces/country-metadata.interface';

interface RestCountriesResponse {
  data?: {
    objects?: unknown[];
    meta?: {
      more?: boolean;
    };
  };
  errors?: Array<{ message?: string }>;
}

interface CountryCache {
  countries: CountryMetadata[];
  expiresAt: number;
}

@Injectable()
export class CountriesService {
  private static readonly cacheTtlMs = 24 * 60 * 60 * 1000;
  private static readonly responseFields = [
    'names.common',
    'codes.alpha_2',
    'currencies',
    'calling_codes',
    'timezones',
    'flag.emoji',
  ].join(',');

  private readonly fallbackCountry: CountryMetadata = {
    countryCode: 'UY',
    countryName: 'Uruguay',
    currencyCodes: ['UYU'],
    defaultCurrency: 'UYU',
    callingCodes: ['598'],
    defaultCallingCode: '598',
    flagEmoji: '\uD83C\uDDFA\uD83C\uDDFE',
    timezones: ['UTC-03:00'],
  };

  private cache: CountryCache | null = null;

  async findAll(): Promise<CountryMetadata[]> {
    if (this.hasFreshCache()) {
      return this.cache!.countries;
    }

    try {
      const countries = await this.fetchAllCountries();
      this.cache = {
        countries,
        expiresAt: Date.now() + CountriesService.cacheTtlMs,
      };
      return countries;
    } catch {
      if (this.cache) {
        return this.cache.countries;
      }

      return [this.fallbackCountry];
    }
  }

  async findByCode(countryCode: string): Promise<CountryMetadata> {
    const normalizedCode = this.normalizeCountryCode(countryCode);

    const cachedCountry = this.cache?.countries.find(
      (country) => country.countryCode === normalizedCode,
    );

    if (cachedCountry) {
      return cachedCountry;
    }

    try {
      const country = await this.fetchCountryByCode(normalizedCode);
      this.mergeCountryIntoCache(country);
      return country;
    } catch (error) {
      const staleCountry = this.cache?.countries.find(
        (country) => country.countryCode === normalizedCode,
      );

      if (staleCountry) {
        return staleCountry;
      }

      if (normalizedCode === this.fallbackCountry.countryCode) {
        return this.fallbackCountry;
      }

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException('Country metadata is unavailable');
    }
  }

  private async fetchAllCountries(): Promise<CountryMetadata[]> {
    const apiKey = this.getApiKey();
    const countries: CountryMetadata[] = [];
    let offset = 0;
    let more = true;

    while (more) {
      const response = await this.fetchRestCountries(
        `?limit=100&offset=${offset}&response_fields=${CountriesService.responseFields}`,
        apiKey,
      );

      const objects = response.data?.objects ?? [];
      countries.push(...objects.map((object) => this.mapCountry(object)));
      more = response.data?.meta?.more === true;
      offset += 100;
    }

    return countries;
  }

  private async fetchCountryByCode(
    countryCode: string,
  ): Promise<CountryMetadata> {
    const apiKey = this.getApiKey();
    const response = await this.fetchRestCountries(
      `/codes.alpha_2/${encodeURIComponent(
        countryCode,
      )}?response_fields=${CountriesService.responseFields}`,
      apiKey,
    );

    const country = response.data?.objects?.[0];
    if (!country) {
      throw new ServiceUnavailableException('Country metadata is unavailable');
    }

    return this.mapCountry(country);
  }

  private async fetchRestCountries(
    path: string,
    apiKey: string,
  ): Promise<RestCountriesResponse> {
    const baseUrl =
      getEnv('REST_COUNTRIES_BASE_URL') ??
      'https://api.restcountries.com/countries/v5';
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const payload = (await response.json()) as RestCountriesResponse;

    if (!response.ok) {
      const message =
        payload.errors?.[0]?.message ?? 'Country metadata is unavailable';
      throw new ServiceUnavailableException(message);
    }

    return payload;
  }

  private getApiKey(): string {
    const apiKey = getEnv('REST_COUNTRIES_API_KEY');

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'REST_COUNTRIES_API_KEY is required to fetch country metadata',
      );
    }

    return apiKey;
  }

  private mapCountry(country: unknown): CountryMetadata {
    const record = country as Record<string, unknown>;
    const codes = this.getRecord(record.codes);
    const names = this.getRecord(record.names);
    const flag = this.getRecord(record.flag);
    const currencyCodes = this.extractCurrencyCodes(record.currencies);
    const callingCodes = this.extractCallingCodes(record.calling_codes);
    const alpha2 = typeof codes.alpha_2 === 'string' ? codes.alpha_2 : '';
    const countryCode = alpha2.toUpperCase();
    const countryName =
      typeof names.common === 'string' ? names.common : countryCode;

    if (!countryCode || !countryName) {
      throw new InternalServerErrorException(
        'Rest Countries response is missing country identifiers',
      );
    }

    return {
      countryCode,
      countryName,
      currencyCodes,
      defaultCurrency: currencyCodes[0] ?? 'USD',
      callingCodes,
      defaultCallingCode: callingCodes[0] ?? '',
      flagEmoji: typeof flag.emoji === 'string' ? flag.emoji : null,
      timezones: this.extractStringArray(record.timezones),
    };
  }

  private extractCurrencyCodes(currencies: unknown): string[] {
    if (Array.isArray(currencies)) {
      return currencies
        .map((currency) => this.getRecord(currency).code)
        .filter((code): code is string => typeof code === 'string')
        .map((code) => code.toUpperCase());
    }

    if (currencies && typeof currencies === 'object') {
      return Object.entries(currencies as Record<string, unknown>).map(
        ([code, value]) => {
          const record = this.getRecord(value);
          const currencyCode =
            typeof record.code === 'string' ? record.code : code;

          return currencyCode.toUpperCase();
        },
      );
    }

    return [];
  }

  private extractStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private extractCallingCodes(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (typeof item === 'string') {
        return item.replace(/^\+/, '');
      }

      const record = this.getRecord(item);
      const root =
        typeof record.root === 'string' ? record.root.replace(/^\+/, '') : '';
      const suffixes = this.extractStringArray(record.suffixes);

      if (!root) {
        return [];
      }

      if (suffixes.length === 0) {
        return [root];
      }

      return suffixes.map((suffix) => `${root}${suffix}`);
    });
  }

  private getRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private hasFreshCache(): boolean {
    return !!this.cache && this.cache.expiresAt > Date.now();
  }

  private mergeCountryIntoCache(country: CountryMetadata) {
    const countries = this.cache?.countries ?? [];
    const nextCountries = countries.filter(
      (cachedCountry) => cachedCountry.countryCode !== country.countryCode,
    );

    nextCountries.push(country);

    this.cache = {
      countries: nextCountries,
      expiresAt:
        this.cache?.expiresAt && this.cache.expiresAt > Date.now()
          ? this.cache.expiresAt
          : Date.now() + CountriesService.cacheTtlMs,
    };
  }

  private normalizeCountryCode(countryCode: string): string {
    return countryCode.trim().toUpperCase();
  }
}
