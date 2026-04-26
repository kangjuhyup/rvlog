import express from 'express';
import './logger.config';
import { logExpressServerStarted } from './features/structured-metadata';
import { createUserRouter } from './user.router';

export function createServer() {
  const app = express();

  app.use(express.json());
  app.use('/users', createUserRouter());

  return app;
}

const app = createServer();
app.listen(3000, () => {
  logExpressServerStarted(3000);
  console.log('Express example listening on port 3000');
});
