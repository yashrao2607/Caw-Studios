import { Test, TestingModule } from '@nestjs/testing';
import { LinksService } from './links.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('LinksService - Search & Pagination Boundaries', () => {
  let service: LinksService;
  let prisma: {
    link: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      link: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            code: 'abc1234',
            longUrl: 'https://example.com/test',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn((args) => Promise.all(args)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();

    service = module.get<LinksService>(LinksService);
  });

  it('strictly caps page_size to 50 even when client requests 1000', async () => {
    const result = await service.search('user_123', 'test', 1, 1000);
    expect(result.page_size).toBe(50);
    expect(result.limit).toBe(50);
    expect(result.page).toBe(1);
    expect(prisma.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 0,
      }),
    );
  });

  it('correctly calculates pagination offset for page 3 with limit 20', async () => {
    await service.search('user_123', 'test', 3, 20);
    expect(prisma.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        skip: 40, // (3 - 1) * 20
      }),
    );
  });

  it('scopes search by principal createdBy and tag filtering', async () => {
    await service.search('user_123', 'keyword', 1, 10, 'marketing');
    expect(prisma.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { createdBy: 'user_123' },
            { tags: { has: 'marketing' } },
            expect.objectContaining({
              OR: expect.any(Array),
            }),
          ]),
        },
      }),
    );
  });
});
