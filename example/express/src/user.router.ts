import { Router } from 'express';
import { UserController } from './user.controller';
import { UserService } from './user.service';

export function createUserRouter() {
  const router = Router();
  const controller = new UserController(new UserService());

  router.get('/', controller.getUsers);
  router.post('/', controller.createUser);
  router.post('/alert-threshold', controller.triggerAlertThreshold);
  router.get('/health', controller.getHealth);

  return router;
}
