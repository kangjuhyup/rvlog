import { Logger, Logging, NoLog } from 'rvlog';
import { CreateUserDto } from './create-user.dto';

@Logging
export class UserService {
  declare logger: Logger;

  async findAll() {
    return [];
  }

  async create(dto: CreateUserDto) {
    this.logger.info('create request received');
    return { id: 1, ...dto };
  }

  @NoLog
  healthCheck() {
    return 'ok';
  }
}
