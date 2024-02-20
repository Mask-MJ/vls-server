import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import {
  PrismaModule,
  providePrismaClientExceptionFilter,
} from 'nestjs-prisma';
import { IamModule } from './iam/iam.module';
import { SystemModule } from './system/system.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'client') }),
    PrismaModule.forRoot({ isGlobal: true }),
    IamModule,
    SystemModule,
    ProjectsModule,
  ],
  controllers: [],
  providers: [providePrismaClientExceptionFilter()],
})
export class AppModule {}
