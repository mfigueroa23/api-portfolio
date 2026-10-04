import { JwtService } from '@nestjs/jwt';
import { PrismaFake } from '../fakes/prisma.fake.js';

const SECRET = 'e2e-owner-jwt-secret';

// Stores the jwt_secret property and returns a valid administrator token, as
// POST /auth/google would.
export async function ownerToken(prisma: PrismaFake): Promise<string> {
  await prisma.property.create({ data: { key: 'jwt_secret', value: SECRET } });
  return new JwtService().signAsync(
    { sub: 'owner' },
    { secret: SECRET, expiresIn: '1h' },
  );
}
