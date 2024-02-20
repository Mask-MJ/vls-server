import { Module } from '@nestjs/common';
import { RolesController } from './roles/roles.controller';
import { UsersController } from './users/users.controller';
import { RolesService } from './roles/roles.service';
import { UsersService } from './users/users.service';
import { HashingService } from 'src/iam/hashing/hashing.service';
import { BcryptService } from 'src/iam/hashing/bcrypt.service';
import { PrismaModule } from 'nestjs-prisma';
import { MenusService } from './menus/menus.service';
import { MenusController } from './menus/menus.controller';

@Module({
  imports: [PrismaModule],
  providers: [
    { provide: HashingService, useClass: BcryptService },
    RolesService,
    UsersService,
    MenusService,
  ],
  controllers: [RolesController, UsersController, MenusController],
})
export class SystemModule {}
