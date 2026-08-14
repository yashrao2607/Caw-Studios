import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CredentialsDto } from './dto/credentials.dto';

@SkipThrottle({ 'create-link': true, redirect: true, analytics: true })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ login: { limit: 10, ttl: 60_000 } })
  @Post('register')
  register(@Body() body: CredentialsDto) {
    return this.auth.register(body.email, body.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: CredentialsDto) {
    return this.auth.login(body.email, body.password);
  }
}
