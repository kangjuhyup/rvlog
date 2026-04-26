import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { logNestApplicationStarted } from './features/structured-metadata';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  logNestApplicationStarted(3000);
}

void bootstrap();
