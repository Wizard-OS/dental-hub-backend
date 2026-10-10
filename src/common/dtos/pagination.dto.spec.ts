import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  it.each([
    [{ limit: '1', offset: '0' }, true],
    [{ limit: '100', offset: '4' }, true],
    [{ limit: '0' }, false],
    [{ limit: '101' }, false],
    [{ limit: '2.5' }, false],
    [{ offset: '-1' }, false],
    [{ offset: '1.5' }, false],
  ])('validates pagination query %j', (input, valid) => {
    const dto = plainToInstance(PaginationDto, input);
    expect(validateSync(dto).length === 0).toBe(valid);
  });
});
