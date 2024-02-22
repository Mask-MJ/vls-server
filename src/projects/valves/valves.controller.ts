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
import { ValvesService } from './valves.service';
import { CreateValveDto } from './dto/create-valve.dto';
import { UpdateValveDto } from './dto/update-valve.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Valve } from './entities/valve.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { QueryValveDto } from './dto/query-valve.dto';
import { ActiveUser } from 'src/iam/decorators/active-user.decorator';
import { ActiveUserData } from 'src/iam/interfaces/active-user-data.interface';

@ApiTags('阀门管理')
@ApiBearerAuth('bearer')
@Controller('valves')
export class ValvesController {
  constructor(private readonly valvesService: ValvesService) {}

  @Post()
  @ApiOperation({ summary: '创建阀门' })
  @ApiCreatedResponse({ type: Valve })
  create(
    @ActiveUser() user: ActiveUserData,
    @Body() createValveDto: CreateValveDto,
  ) {
    return this.valvesService.create(user, createValveDto);
  }

  @Get()
  @ApiOperation({ summary: '获取阀门列表' })
  @ApiOkResponse({ type: Valve, isArray: true })
  findAll(
    @ActiveUser() user: ActiveUserData,
    @Query() paginationQueryDto: PaginationQueryDto,
    @Query() queryValveDto: QueryValveDto,
  ) {
    return this.valvesService.findAll(user, paginationQueryDto, queryValveDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取阀门信息' })
  @ApiOkResponse({ type: Valve })
  findOne(@Param('id') id: number) {
    return this.valvesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新阀门信息' })
  @ApiOkResponse({ type: Valve })
  update(@Param('id') id: number, @Body() updateValveDto: UpdateValveDto) {
    return this.valvesService.update(id, updateValveDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除阀门' })
  remove(@Param('id') id: number) {
    return this.valvesService.remove(id);
  }
}
