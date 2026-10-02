import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { ContactModule } from './contact/contact.module.js';
import { ContentModule } from './content/content.module.js';
import { CorsModule } from './cors/cors.module.js';
import { JsonBodyMiddleware } from './common/middlewares/json-body.middleware.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { PropertiesModule } from './properties/properties.module.js';
import { ContactRateLimitMiddleware } from './rate-limit/middlewares/contact-rate-limit.middleware.js';
import { LoginRateLimitMiddleware } from './rate-limit/middlewares/login-rate-limit.middleware.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';

@Module({
  imports: [
    DatabaseModule,
    PropertiesModule,
    CorsModule,
    RateLimitModule,
    ContactModule,
    AuthModule,
    ContentModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  // Order matters: the rate limits run before the JSON parser so malformed
  // bodies are counted too, and a blocked login is rejected before parsing.
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ContactRateLimitMiddleware)
      .forRoutes({ path: 'contact', method: RequestMethod.POST });
    consumer
      .apply(LoginRateLimitMiddleware)
      .forRoutes({ path: 'auth/login', method: RequestMethod.POST });
    consumer.apply(JsonBodyMiddleware).forRoutes('{*path}');
  }
}
