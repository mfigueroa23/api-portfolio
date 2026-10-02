import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JsonBodyMiddleware } from './common/middlewares/json-body.middleware.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(JsonBodyMiddleware).forRoutes('{*path}');
  }
}
