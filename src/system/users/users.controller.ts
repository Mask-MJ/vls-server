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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { ActiveUser } from 'src/iam/decorators/active-user.decorator';
import { ActiveUserData } from 'src/iam/interfaces/active-user-data.interface';
import { User } from './entities/user.entity';
import { QueryUserDto } from './dto/query-user.dto';

@ApiTags('用户管理')
@ApiBearerAuth('bearer')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: '创建用户' })
  @ApiCreatedResponse({ type: User })
  async create(@Body() createUserDto: CreateUserDto) {
    return new User(await this.usersService.create(createUserDto));
  }

  @Get()
  @ApiOperation({ summary: '获取用户列表' })
  @ApiOkResponse({ type: User, isArray: true })
  async findAll(
    @Query() paginationQueryDto: PaginationQueryDto,
    @Query() queryUserDto: QueryUserDto,
  ) {
    const users = await this.usersService.findAll(
      paginationQueryDto,
      queryUserDto,
    );
    return users.map((user) => new User(user));
  }

  @Get('info')
  @ApiOperation({ summary: '获取用户信息' })
  @ApiOkResponse({ type: User })
  async findSelf(@ActiveUser() user: ActiveUserData) {
    return new User(await this.usersService.findSelf(user.sub));
  }

  @Get(':id')
  @ApiOperation({ summary: '获取用户信息' })
  @ApiOkResponse({ type: User })
  async findOne(@Param('id') id: number) {
    return new User(await this.usersService.findOne(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiOkResponse({ type: User })
  async update(@Param('id') id: number, @Body() updateUserDto: UpdateUserDto) {
    return new User(await this.usersService.update(id, updateUserDto));
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用户' })
  @ApiOkResponse({ type: User })
  async remove(@Param('id') id: number) {
    return new User(await this.usersService.remove(id));
  }
}
