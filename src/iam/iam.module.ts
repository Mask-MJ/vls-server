import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { HashingService } from './hashing/hashing.service';
import { BcryptService } from './hashing/bcrypt.service';

import jwtConfig from './config/jwt.config';
import { AuthenticationController } from './authentication/authentication.controller';
import { AuthenticationService } from './authentication/authentication.service';
import { AuthenticationGuard } from './authentication/guards/authentication.guard';
import { AccessTokenGuard } from './authentication/guards/access-token.guard';
import { RefreshTokenIdsStorage } from './authentication/refresh-token-ids.storage';
import { RolesGuard } from './authorization/guards/roles.guard';
import { PrismaModule } from 'nestjs-prisma';

@Module({
  imports: [
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forFeature(jwtConfig),
    PrismaModule,
  ],
  providers: [
    { provide: HashingService, useClass: BcryptService },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    AccessTokenGuard,
    RefreshTokenIdsStorage,
    AuthenticationService,
  ],
  controllers: [AuthenticationController],
})
export class IamModule {}
