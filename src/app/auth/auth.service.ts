import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service.js';
import { PropertiesService } from '../properties/properties.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';
import { verifyPassword } from './utils/password.js';

export const TOKEN_LIFETIME_SECONDS = 3600;

export interface AccessToken {
  accessToken: string;
  expiresIn: number;
}

// Hash checked when the username does not exist, so an unknown user costs the
// same scrypt work as a wrong password and timing does not reveal which failed.
const DUMMY_HASH =
  'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly properties: PropertiesService,
    private readonly jwt: JwtService,
  ) {}

  async login({ username, password }: LoginDto): Promise<AccessToken> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { username },
    });
    const valid = await verifyPassword(
      password,
      admin?.passwordHash ?? DUMMY_HASH,
    );
    if (!admin || !valid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const secret = await this.properties.get('jwt_secret');
    if (!secret) {
      this.logger.error('The jwt_secret property is not configured');
      throw new InternalServerErrorException('Internal server error.');
    }

    const payload: JwtPayload = { sub: admin.id };
    const accessToken = await this.jwt.signAsync(payload, {
      secret,
      algorithm: 'HS256',
      expiresIn: TOKEN_LIFETIME_SECONDS,
    });
    return { accessToken, expiresIn: TOKEN_LIFETIME_SECONDS };
  }
}
