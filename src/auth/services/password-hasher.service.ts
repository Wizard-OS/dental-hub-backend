import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordHasherService {
  hash(value: string): string {
    return bcrypt.hashSync(value, 10);
  }

  compare(value: string, hash: string): boolean {
    return bcrypt.compareSync(value, hash);
  }
}
