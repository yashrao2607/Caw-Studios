import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });
    return { access_token: await this.sign(user.id, user.email), user: this.publicUser(user) };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { access_token: await this.sign(user.id, user.email), user: this.publicUser(user) };
  }

  async validateToken(token: string): Promise<{ sub: string; email: string } | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token);
      return payload;
    } catch {
      return null;
    }
  }

  private async sign(userId: number, email: string) {
    return this.jwt.signAsync({ sub: String(userId), email });
  }

  private publicUser(user: { id: number; email: string; createdAt: Date }) {
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
