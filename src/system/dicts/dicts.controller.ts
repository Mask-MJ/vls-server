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
import { DictsService } from './dicts.service';
import { CreateDictDto } from './dto/create-dict.dto';
import { UpdateDictDto } from './dto/update-dict.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Dict } from './entities/dict.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { QueryDictDto } from './dto/query-dict.dto';

@ApiTags('字典管理')
@ApiBearerAuth('bearer')
@Controller('dicts')
export class DictsController {
  constructor(private readonly dictsService: DictsService) {}

  @Post()
  @ApiOperation({ summary: '创建字典' })
  @ApiCreatedResponse({ type: Dict })
  create(@Body() createDictDto: CreateDictDto) {
    return this.dictsService.create(createDictDto);
  }

  @Get()
  @ApiOperation({ summary: '获取字典列表' })
  @ApiOkResponse({ type: Dict, isArray: true })
  findAll(
    @Query() paginationQueryDto: PaginationQueryDto,
    @Query() queryDictDto: QueryDictDto,
  ) {
    return this.dictsService.findAll(paginationQueryDto, queryDictDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取字典信息' })
  @ApiOkResponse({ type: Dict })
  findOne(@Param('id') id: string) {
    return this.dictsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新字典' })
  @ApiOkResponse({ type: Dict })
  update(@Param('id') id: string, @Body() updateDictDto: UpdateDictDto) {
    return this.dictsService.update(+id, updateDictDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除字典' })
  remove(@Param('id') id: string) {
    return this.dictsService.remove(+id);
  }
}
