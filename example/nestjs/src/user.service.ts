import { Injectable } from '@nestjs/common';
import { Logger, Logging } from '@kangjuhyup/rvlog';
import { CreateUserDto } from './create-user.dto';

@Logging
@Injectable()
export class UserService {
  declare logger: Logger;

  async findAll() {
    return [];
  }

  async create(dto: CreateUserDto) {
    this.logger.info('before repository save');
    return { id: 1, ...dto };
  }
}
