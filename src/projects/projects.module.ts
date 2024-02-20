import { Module } from '@nestjs/common';
import { FactoriesService } from './factories/factories.service';
import { FactoriesController } from './factories/factories.controller';
import { PrismaModule } from 'nestjs-prisma';
import { ValvesService } from './valves/valves.service';
import { ValvesController } from './valves/valves.controller';

@Module({
  imports: [PrismaModule],
  providers: [FactoriesService, ValvesService],
  controllers: [FactoriesController, ValvesController],
})
export class ProjectsModule {}
