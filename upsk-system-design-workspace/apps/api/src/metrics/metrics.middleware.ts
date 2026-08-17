import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.path === '/metrics') {
      return next();
    }

    const start = process.hrtime();

    res.on('finish', () => {
      const diff = process.hrtime(start);
      const durationSeconds = diff[0] + diff[1] / 1e9;
      const path = req.route?.path || req.path || 'unknown';
      const status = res.statusCode.toString();
      const method = req.method;

      this.metricsService.httpRequestsTotal.inc({ method, path, status });
      this.metricsService.httpRequestDurationSeconds.observe({ method, path, status }, durationSeconds);
    });

    next();
  }
}
