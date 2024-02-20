import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { FactoriesService } from './factories.service';
import { CreateFactoryDto } from './dto/create-factory.dto';
import { UpdateFactoryDto } from './dto/update-factory.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Factory } from './entities/factory.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { QueryFactoryDto } from './dto/query-factory.dto';
import { ActiveUser } from 'src/iam/decorators/active-user.decorator';
import { ActiveUserData } from 'src/iam/interfaces/active-user-data.interface';
@ApiTags('工厂管理')
@ApiBearerAuth('bearer')
@Controller('factories')
export class FactoriesController {
  constructor(private readonly factoriesService: FactoriesService) {}

  @Post()
  @ApiOperation({ summary: '创建工厂' })
  @ApiCreatedResponse({ type: Factory })
  create(
    @ActiveUser() user: ActiveUserData,
    @Body() createFactoryDto: CreateFactoryDto,
  ) {
    return this.factoriesService.create(user, createFactoryDto);
  }

  @Get()
  @ApiOperation({ summary: '获取工厂列表' })
  @ApiOkResponse({ type: Factory, isArray: true })
  findAll(
    @Query() paginationQueryDto: PaginationQueryDto,
    @Query() queryFactoryDto: QueryFactoryDto,
  ) {
    return this.factoriesService.findAll(paginationQueryDto, queryFactoryDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.factoriesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFactoryDto: UpdateFactoryDto) {
    return this.factoriesService.update(+id, updateFactoryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.factoriesService.remove(+id);
  }
}
