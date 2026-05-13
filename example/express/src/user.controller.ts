import type { Request, Response } from 'express';
import { CreateUserDto } from './create-user.dto';
import { triggerExpressAlertThreshold } from './features/alert-routing';
import { UserService } from './user.service';

export class UserController {
  constructor(private readonly userService: UserService) {}

  getUsers = async (_req: Request, res: Response) => {
    const users = await this.userService.findAll();
    res.json(users);
  };

  createUser = async (req: Request, res: Response) => {
    const dto = Object.assign(new CreateUserDto(), req.body);
    const createdUser = await this.userService.create(dto);
    res.status(201).json(createdUser);
  };

  getHealth = (_req: Request, res: Response) => {
    res.json({ status: this.userService.healthCheck() });
  };

  triggerAlertThreshold = async (_req: Request, res: Response) => {
    res.json(await triggerExpressAlertThreshold());
  };
}
