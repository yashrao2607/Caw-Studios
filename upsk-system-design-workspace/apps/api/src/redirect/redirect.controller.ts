import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import type { Response } from 'express';
import { LinksService } from '../links/links.service';
import { ClicksProducer } from '../queue/clicks.producer';

@SkipThrottle({ login: true, 'create-link': true, analytics: true })
@Controller('r')
export class RedirectController {
  constructor(
    private readonly linksService: LinksService,
    private readonly clicksProducer: ClicksProducer,
  ) {}

  @Throttle({ redirect: { limit: 120, ttl: 60_000 } })
  @Get(':code')
  async redirect(
    @Param('code') code: string,
    @Res() res: Response,
  ) {
    const link = await this.linksService.findByCode(code);
    if (!link) {
      throw new NotFoundException();
    }
    const ip = (res.req.ip ?? '').trim();
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex') : null;
    void this.clicksProducer
      .enqueue({
        code,
        clickedAt: new Date().toISOString(),
        userAgent: res.req.headers['user-agent'] ?? null,
        referrer: res.req.headers['referer'] ?? null,
        ipHash,
      })
      .catch((error: unknown) => {
        // Redirect must not fail because of analytics; log and continue.
        res.locals.clickQueueError = error;
      });
    res
      .status(302)
      .setHeader('Location', link.longUrl)
      .setHeader('x-cache', link.cache)
      .end();
  }
}
