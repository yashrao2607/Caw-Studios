# Module 03: Raw Task Outputs (First-Pass Run)

## 1. Task TSK-01 Raw Execution Output (Prisma Schema)

```prisma
// apps/api/prisma/schema.prisma additions

enum Role {
  OWNER
  ADMIN
  MEMBER
}

model Team {
  id          String       @id @default(uuid())
  name        String       @db.VarChar(100)
  slug        String       @unique @db.VarChar(100)
  ownerId     String       @map("owner_id")
  owner       User         @relation("TeamOwner", fields: [ownerId], references: [id])
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")
  members     TeamMember[]
  invites     TeamInvite[]
  comments    Comment[]
  events      ActivityEvent[]
  auditLogs   AuditLog[]

  @@map("teams")
}

model TeamMember {
  id        String   @id @default(uuid())
  teamId    String   @map("team_id")
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role     @default(MEMBER)
  joinedAt  DateTime @default(now()) @map("joined_at")

  @@unique([teamId, userId])
  @@map("team_members")
}
```

---

## 2. Task TSK-02 Raw Execution Output (Teams Service & Controller)

```typescript
// apps/api/src/teams/teams.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { Role } from '@prisma/client';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTeam(userId: string, dto: CreateTeamDto) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await this.prisma.team.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Team slug already taken');
    }

    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: dto.name,
          slug,
          ownerId: userId,
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId,
          role: Role.OWNER,
        },
      });

      return team;
    });
  }

  async getUserTeams(userId: string) {
    return this.prisma.team.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true, joinedAt: true },
        },
      },
    });
  }
}
```

---

## 3. Task TSK-03 Raw Execution Output (TeamRoleGuard)

```typescript
// apps/api/src/teams/guards/team-role.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class TeamRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const teamId = request.params.id || request.params.teamId;

    if (!teamId) {
      throw new BadRequestException('Team ID required for role authorization');
    }

    if (!userId) {
      throw new ForbiddenException('User authentication required');
    }

    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this team');
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient team permissions');
    }

    return true;
  }
}
```
