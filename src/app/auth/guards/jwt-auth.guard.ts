import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PropertiesService } from '../../properties/properties.service.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';

// Protects the content write endpoints: requires `Authorization: Bearer <jwt>`
// signed with the jwt_secret property. Any token problem is a plain 401.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly properties: PropertiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    await this.verify(request.headers.authorization);
    return true;
  }

  // Also used by RawBodyMiddleware, which must reject an upload before
  // reading its body.
  async verify(authorization: string | undefined): Promise<void> {
    const [scheme, token, ...rest] = (authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token || rest.length > 0) {
      throw new UnauthorizedException('Unauthorized.');
    }

    const secret = await this.properties.get('jwt_secret');
    if (!secret) {
      this.logger.error('The jwt_secret property is not configured');
      throw new InternalServerErrorException('Internal server error.');
    }

    try {
      await this.jwt.verifyAsync<JwtPayload>(token, {
        secret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Unauthorized.');
    }
  }
}
