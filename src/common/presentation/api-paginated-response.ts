import { ApiOkResponse } from '@nestjs/swagger';

export function ApiPaginatedResponse(): MethodDecorator {
  return ApiOkResponse({
    description: 'Bounded collection of accessible records',
    schema: {
      type: 'object',
      required: ['items', 'total', 'limit', 'offset'],
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        total: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', default: 30, minimum: 1, maximum: 100 },
        offset: { type: 'integer', default: 0, minimum: 0 },
      },
    },
  });
}
