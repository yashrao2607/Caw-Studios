import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateLinkDto } from './dto/create-link.dto';

const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;
const MAX_CODE_RETRIES = 5;
const REDIRECT_CACHE_TTL_SECONDS = 3600;

type RedirectTarget = {
  longUrl: string;
  expiresAt: Date | null;
  cache: 'MISS' | 'DOWN';
};

const inflight = new Map<string, Promise<RedirectTarget | null>>();

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateLinkDto, createdBy?: string) {
    const expiresAt = dto.expires_at ? new Date(dto.expires_at) : null;

    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new Error('expires_at must be in the future');
    }

    let code = '';
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      code = this.generateCode();
      try {
        const link = await this.prisma.link.create({
          data: {
            code,
            longUrl: dto.long_url,
            createdBy: createdBy ?? null,
            expiresAt,
            tags: dto.tags ?? [],
          },
        });
        return this.toResponse(link);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('could not allocate a unique short code');
  }

  async list(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.link.findMany({
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.link.count(),
    ]);

    return {
      items: items.map((link) => this.toResponse(link)),
      total,
      page,
      limit,
    };
  }

  async listByUser(createdBy: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.link.findMany({
        where: { createdBy },
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.link.count({ where: { createdBy } }),
    ]);

    return {
      items: items.map((link) => this.toResponse(link)),
      total,
      page,
      limit,
    };
  }

  async search(createdBy: string, q: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const needle = q.trim();
    const where =
      needle.length === 0
        ? { createdBy }
        : {
            createdBy,
            OR: [
              { longUrl: { contains: needle, mode: Prisma.QueryMode.insensitive } },
              { code: { contains: needle, mode: Prisma.QueryMode.insensitive } },
              { tags: { has: needle } },
            ],
          };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.link.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.link.count({ where }),
    ]);

    return {
      items: items.map((link) => this.toResponse(link)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const link = await this.prisma.link.findUnique({ where: { id } });
    if (!link) {
      throw new NotFoundException('link not found');
    }
    return this.toResponse(link);
  }

  async findOneForUser(id: number, userId: string) {
    const link = await this.prisma.link.findFirst({
      where: { id, createdBy: userId },
    });
    if (!link) {
      throw new NotFoundException('link not found');
    }
    return this.toResponse(link);
  }

  async analyticsForUser(
    id: number,
    userId: string,
    from: Date,
    to: Date,
  ) {
    const link = await this.prisma.link.findFirst({
      where: { id, createdBy: userId },
    });
    if (!link) {
      throw new NotFoundException('link not found');
    }
    const where = {
      linkId: id,
      clickedAt: { gte: from, lte: to },
    };
    const [count, last] = await this.prisma.$transaction([
      this.prisma.clickEvent.count({ where }),
      this.prisma.clickEvent.findFirst({
        where,
        orderBy: { clickedAt: 'desc' },
        select: { clickedAt: true },
      }),
    ]);
    return {
      link_id: id,
      from: from.toISOString(),
      to: to.toISOString(),
      click_count: count,
      last_clicked_at: last?.clickedAt.toISOString() ?? null,
    };
  }

  async updateForUser(
    id: number,
    userId: string,
    dto: { longUrl?: string; expiresAt?: string | null },
  ) {
    const link = await this.prisma.link.findFirst({
      where: { id, createdBy: userId },
    });
    if (!link) {
      throw new NotFoundException('link not found');
    }
    if (
      dto.expiresAt !== undefined &&
      dto.expiresAt !== null &&
      new Date(dto.expiresAt).getTime() <= Date.now()
    ) {
      throw new BadRequestException('expires_at must be in the future');
    }
    const updated = await this.prisma.link.update({
      where: { id },
      data: {
        longUrl: dto.longUrl ?? link.longUrl,
        expiresAt: dto.expiresAt === null ? null : (dto.expiresAt ?? link.expiresAt),
      },
    });
    await this.redis.del(`link:code:${updated.code}`).catch(() => undefined);
    await this.redis.del(`link:id:${updated.id}`).catch(() => undefined);
    return this.toResponse(updated);
  }

  async removeForUser(id: number, userId: string) {
    const link = await this.prisma.link.findFirst({
      where: { id, createdBy: userId },
    });
    if (!link) {
      throw new NotFoundException('link not found');
    }
    await this.prisma.clickEvent.deleteMany({ where: { linkId: id } });
    await this.prisma.link.delete({ where: { id } });
    await this.redis.del(`link:code:${link.code}`).catch(() => undefined);
    return { deleted: true, id };
  }

  async findByCode(code: string) {
    const cacheKey = `link:code:${code}`;
    let cached: string | null = null;
    try {
      cached = await this.redis.get(cacheKey);
    } catch (error: unknown) {
      return this.singleFlight(code, 'DOWN');
    }
    if (cached) {
      const parsed = JSON.parse(cached) as {
        longUrl: string;
        expiresAt: string | null;
      };
      if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
        void this.redis.del(cacheKey).catch(() => undefined);
      } else {
        return {
          longUrl: parsed.longUrl,
          expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
          cache: 'HIT' as const,
        };
      }
    }

    return this.singleFlight(code, 'MISS');
  }

  private async singleFlight(code: string, cache: 'MISS' | 'DOWN') {
    const existing = inflight.get(code);
    if (existing) {
      return existing;
    }
    const promise = this.loadFromDb(code, cache);
    inflight.set(code, promise);
    void promise.finally(() => {
      inflight.delete(code);
    });
    return promise;
  }

  private async loadFromDb(code: string, cache: 'MISS' | 'DOWN') {
    const link = await this.prisma.link.findUnique({ where: { code } });
    if (!link) {
      return null;
    }
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      void this.redis.del(`link:code:${code}`).catch(() => undefined);
      return null;
    }
    try {
      await this.redis.set(
        `link:code:${code}`,
        JSON.stringify({
          longUrl: link.longUrl,
          expiresAt: link.expiresAt?.toISOString() ?? null,
        }),
        REDIRECT_CACHE_TTL_SECONDS,
      );
    } catch (error: unknown) {
      // Redis unavailable: still serve from DB (graceful degradation).
    }
    return {
      longUrl: link.longUrl,
      expiresAt: link.expiresAt,
      cache: cache as 'MISS' | 'DOWN',
    };
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return code;
  }

  private toResponse(link: {
    id: number;
    code: string;
    longUrl: string;
    createdAt: Date;
  }) {
    return {
      id: link.id,
      code: link.code,
      short_url: `http://localhost:${process.env.PORT}/r/${link.code}`,
      long_url: link.longUrl,
      created_at: link.createdAt.toISOString(),
    };
  }
}
