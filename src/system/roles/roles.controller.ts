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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Role } from './entities/role.entity';
import { QueryRoleDto } from './dto/query-role.dto';

@ApiTags('角色管理')
@ApiBearerAuth('bearer')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({ summary: '创建角色' })
  @ApiCreatedResponse({ type: Role })
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ summary: '获取角色列表' })
  @ApiOkResponse({ type: Role, isArray: true })
  findAll(
    @Query() paginationQueryDto: PaginationQueryDto,
    @Query() queryRoleDto: QueryRoleDto,
  ) {
    return this.rolesService.findAll(paginationQueryDto, queryRoleDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取角色信息' })
  @ApiOkResponse({ type: Role })
  findOne(@Param('id') id: number) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新角色信息' })
  @ApiOkResponse({ type: Role })
  update(@Param('id') id: number, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除角色' })
  @ApiOkResponse({ type: Role })
  remove(@Param('id') id: number) {
    return this.rolesService.remove(id);
  }
}
