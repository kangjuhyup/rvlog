import { Logger, Logging, NoLog } from '@kangjuhyup/rvlog';
import { CreateUserDto } from './create-user.dto';
import { logExpressUserCreated } from './features/structured-metadata';

@Logging
export class UserService {
  declare logger: Logger;

  async findAll() {
    return [];
  }

  async create(dto: CreateUserDto) {
    this.logger.info('create request received');
    const createdUser = { id: 1, ...dto };

    logExpressUserCreated(createdUser);
    return createdUser;
  }

  @NoLog
  healthCheck() {
    return 'ok';
  }
}
