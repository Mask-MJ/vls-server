import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { REQUEST_USER_KEY } from 'src/iam/iam.constants';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const contextRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (contextRoles) return true;
    const request = context.switchToHttp().getRequest();
    const path: string = request.route.path;
    const user = request[REQUEST_USER_KEY];
    const userInfo = await this.prismaService.user.findUnique({
      where: { id: user.sub },
      include: { roles: { include: { menus: true } } },
    });

    if (!userInfo) return false;
    return userInfo.roles.some((role) =>
      role.menus.some((menu) =>
        path.startsWith('/api/' + menu.path.split('/').pop()),
      ),
    );
  }
}
