import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';

@SkipThrottle({ login: true, redirect: true, analytics: true })
@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ 'create-link': { limit: 30, ttl: 60_000 } })
  @Post()
  async create(@Body() dto: CreateLinkDto, @CurrentUser() user: RequestUser) {
    try {
      return await this.linksService.create(dto, user.id);
    } catch (error) {
      if (error instanceof Error && error.message === 'expires_at must be in the future') {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    return this.linksService.listByUser(user.id, pageNum, limitNum);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  search(
    @CurrentUser() user: RequestUser,
    @Query('q') q = '',
    @Query('tag') tag?: string,
    @Query('page') page = '1',
    @Query('page_size') pageSize?: string,
    @Query('limit') limit = '20',
  ) {
    const rawLimit = pageSize ?? limit;
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, Number.parseInt(rawLimit, 10) || 20));
    return this.linksService.search(user.id, q, pageNum, limitNum, tag);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ analytics: { limit: 60, ttl: 60_000 } })
  @Get(':id/analytics')
  analytics(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const parsedFrom = new Date(from);
    const parsedTo = new Date(to);
    if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime())) {
      throw new BadRequestException(
        'from and to must be ISO date strings, e.g. 2000-01-01',
      );
    }
    return this.linksService.analyticsForUser(id, user.id, parsedFrom, parsedTo);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.linksService.findOneForUser(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLinkDto,
    @CurrentUser() user: RequestUser,
  ) {
    try {
      return this.linksService.updateForUser(id, user.id, {
        longUrl: dto.long_url,
        expiresAt: dto.expires_at,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'expires_at must be in the future') {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.linksService.removeForUser(id, user.id);
  }
}
