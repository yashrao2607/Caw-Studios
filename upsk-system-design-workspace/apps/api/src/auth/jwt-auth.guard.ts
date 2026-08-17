import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['authorization'];
    if (!header || typeof header !== 'string' || !header.trim()) {
      throw new UnauthorizedException('Authorization header required');
    }
    const parts = header.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization format');
    }
    const token = parts[1];
    if (!token || token.trim().length === 0) {
      throw new UnauthorizedException('Bearer token missing');
    }
    const payload = await this.auth.validateToken(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request.user = { id: payload.sub, email: payload.email };
    return true;
  }
}
