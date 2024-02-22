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
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Template } from './entities/template.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { QueryTemplateDto } from './dto/query-template.dto';
import { ActiveUser } from 'src/iam/decorators/active-user.decorator';
import { ActiveUserData } from 'src/iam/interfaces/active-user-data.interface';

@ApiTags('模板管理')
@ApiBearerAuth('bearer')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: '创建模板' })
  @ApiCreatedResponse({ type: Template })
  create(
    @ActiveUser() user: ActiveUserData,
    @Body() createTemplateDto: CreateTemplateDto,
  ) {
    return this.templatesService.create(user, createTemplateDto);
  }

  @Get()
  @ApiOperation({ summary: '获取模板列表' })
  @ApiOkResponse({ type: Template, isArray: true })
  findAll(
    @Query() paginationQueryDto: PaginationQueryDto,
    @Query() queryTemplateDto: QueryTemplateDto,
  ) {
    return this.templatesService.findAll(paginationQueryDto, queryTemplateDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取模板信息' })
  @ApiOkResponse({ type: Template })
  findOne(@Param('id') id: number) {
    return this.templatesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新模板信息' })
  update(
    @Param('id') id: number,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除模板' })
  remove(@Param('id') id: number) {
    return this.templatesService.remove(id);
  }
}
