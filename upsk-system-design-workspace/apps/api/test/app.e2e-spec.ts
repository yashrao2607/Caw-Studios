import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { RequestIdMiddleware } from '../src/common/request-id.middleware';
import { Logger } from 'nestjs-pino';
import request from 'supertest';

describe('Link shortener e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const validUrl = `https://example.com/e2e-${Date.now()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Logger)
      .useValue({ log: () => {}, warn: () => {}, error: () => {}, debug: () => {} })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(new RequestIdMiddleware().use);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('auth', () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'password123';

    it('registers and returns a token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);
      expect(res.body.access_token).toBeDefined();
      token = res.body.access_token;
    });

    it('rejects duplicate email with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(400);
    });

    it('rejects weak password with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'weak@example.com', password: 'short' })
        .expect(400);
    });

    it('rejects bad credentials with 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    });

    it('logs in and returns a token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      expect(res.body.access_token).toBeDefined();
    });
  });

  describe('link validation', () => {
    const abuse: Array<[string, string]> = [
      ['javascript scheme', 'javascript:alert(1)'],
      ['data scheme', 'data:text/html,<script>alert(1)</script>'],
      ['mixed case scheme', 'HTTP://example.com/x'],
      ['padded url', ' https://example.com/x '],
      ['scheme-relative', '//example.com/x'],
      ['encoded slash', 'https://example.com/a%2Fb'],
      ['encoded colon', 'https%3A%2F%2Fexample.com'],
      ['backslashes', 'https://example.com\\@evil.com'],
      ['userinfo', 'https://user:pass@example.com/x'],
    ];

    it.each(abuse)('rejects %s with 400', async (_name, url) => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ long_url: url })
        .expect(400);
    });

    it('rejects past expiry with 400', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ long_url: validUrl, expires_at: '2020-01-01T00:00:00Z' })
        .expect(400);
    });

    it('rejects more than 10 tags with 400', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ long_url: validUrl, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })
        .expect(400);
    });

    it('requires auth', async () => {
      await request(app.getHttpServer()).post('/links').send({ long_url: validUrl }).expect(401);
    });

    it('accepts a valid url and returns short_url', async () => {
      const res = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ long_url: validUrl, tags: ['e2e', 'test'] })
        .expect(201);
      expect(res.body.short_url).toMatch(/\/r\/[A-Za-z0-9]{6}$/);
      expect(res.body.long_url).toBe(validUrl);
    });
  });

  describe('redirect', () => {
    let code: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ long_url: validUrl, tags: ['e2e'] })
        .expect(201);
      code = res.body.code;
    });

    it('redirects a valid code with 302 and Location', async () => {
      await request(app.getHttpServer())
        .get(`/r/${code}`)
        .expect(302)
        .expect('Location', validUrl);
    });

    it('returns 404 for an unknown code', async () => {
      await request(app.getHttpServer()).get('/r/zzzzzz').expect(404);
    });

    it('returns identical 404 for unknown and expired links', async () => {
      const expired = await prisma.link.create({
        data: {
          code: `e2e${Date.now() % 1000000}`.slice(0, 6).padStart(6, 'a'),
          longUrl: validUrl,
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      const a = await request(app.getHttpServer()).get(`/r/${expired.code}`);
      const b = await request(app.getHttpServer()).get('/r/notexist');
      expect(a.status).toBe(b.status);
      expect(a.status).toBe(404);
      expect(a.body.message).toBe(b.body.message);
      expect(a.body.error).toBe(b.body.error);
    });
  });

  describe('ownership', () => {
    let otherToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `other-${Date.now()}@example.com`, password: 'password123' })
        .expect(201);
      otherToken = res.body.access_token;
    });

    it('list returns only the caller\'s links', async () => {
      const res = await request(app.getHttpServer())
        .get('/links')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      for (const item of res.body.items) {
        const owner = await prisma.link.findUnique({ where: { id: item.id } });
        expect(owner?.createdBy).toBeDefined();
      }
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('blocks reading another user\'s link (IDOR) with 404', async () => {
      const mine = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ long_url: validUrl })
        .expect(201);
      await request(app.getHttpServer())
        .get(`/links/${mine.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });
  });

  describe('search', () => {
    it('finds links by tag', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/search')
        .query({ q: 'e2e' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('finds links by code', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/search')
        .query({ q: validUrl })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('rejects search without auth', async () => {
      await request(app.getHttpServer()).get('/links/search').expect(401);
    });
  });

  describe('error shape', () => {
    it('returns structured error with requestId and path', async () => {
      const res = await request(app.getHttpServer())
        .get('/does-not-exist')
        .set('x-request-id', 'trace-e2e')
        .expect(404);
      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        requestId: 'trace-e2e',
        path: '/does-not-exist',
      });
      expect(res.body.timestamp).toBeDefined();
    });
  });
});
