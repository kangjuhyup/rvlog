import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateUserDto } from "./create-user.dto";
import { NestAlertRoutingExample } from "./features/alert-routing";
import { UserService } from "./user.service";

@Controller("users")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly alertRoutingExample: NestAlertRoutingExample,
  ) {}

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Post("alert-threshold")
  async triggerAlertThreshold() {
    return this.alertRoutingExample.triggerThreshold();
  }
}
