import './logger.config';
import { CreateUserDto } from './create-user.dto';
import { runAlertRoutingExample } from './features/alert-routing';
import { logBasicUserCreated } from './features/structured-metadata';
import { UserService } from './user.service';

async function bootstrap() {
  const service = new UserService();
  const dto = new CreateUserDto();
  dto.name = '홍길동';
  dto.email = 'hong@gmail.com';
  dto.phoneNumber = '01012345678';

  const createdUser = await service.create(dto);
  logBasicUserCreated(createdUser);
  await runAlertRoutingExample();
  service.healthCheck();
}

void bootstrap();
