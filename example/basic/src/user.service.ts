import { Logger, Logging, NoLog } from 'rvlog';
import { CreateUserDto } from './create-user.dto';

@Logging
export class UserService {
  declare logger: Logger;

  async create(dto: CreateUserDto) {
    this.logger.info('manual log before create');
    return {
      id: 1,
      ...dto,
    };
  }

  @NoLog
  healthCheck() {
    return 'ok';
  }
}
