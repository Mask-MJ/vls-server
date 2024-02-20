import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Menu } from './entities/menu.entity';

@ApiTags('菜单管理')
@ApiBearerAuth('bearer')
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @ApiOperation({ summary: '创建菜单' })
  @ApiCreatedResponse({ type: Menu })
  create(@Body() createMenuDto: CreateMenuDto) {
    return this.menusService.create(createMenuDto);
  }

  @Get()
  @ApiOperation({ summary: '获取菜单列表' })
  @ApiOkResponse({ type: Menu, isArray: true })
  findAll() {
    return this.menusService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取菜单信息' })
  @ApiOkResponse({ type: Menu })
  findOne(@Param('id') id: number) {
    return this.menusService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新菜单信息' })
  @ApiOkResponse({ type: Menu })
  update(@Param('id') id: number, @Body() updateMenuDto: UpdateMenuDto) {
    return this.menusService.update(id, updateMenuDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除菜单' })
  @ApiOkResponse({ type: Menu })
  remove(@Param('id') id: number) {
    return this.menusService.remove(id);
  }
}
