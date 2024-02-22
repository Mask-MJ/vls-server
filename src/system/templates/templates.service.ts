import { Injectable } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PrismaService } from 'nestjs-prisma';
import { ActiveUserData } from 'src/iam/interfaces/active-user-data.interface';
import { QueryTemplateDto } from './dto/query-template.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  create(user: ActiveUserData, createTemplateDto: CreateTemplateDto) {
    return this.prisma.template.create({
      data: { ...createTemplateDto, creater: { connect: { id: user.sub } } },
    });
  }

  findAll(
    paginationQueryDto: PaginationQueryDto,
    queryTemplateDto: QueryTemplateDto,
  ) {
    const { page, pageSize } = paginationQueryDto;
    const { name } = queryTemplateDto;
    return this.prisma.template.findMany({
      take: pageSize,
      skip: (page - 1) * pageSize,
      where: {
        name: { contains: name },
      },
    });
  }

  findOne(id: number) {
    return this.prisma.template.findUnique({ where: { id } });
  }

  update(id: number, updateTemplateDto: UpdateTemplateDto) {
    return this.prisma.template.update({
      where: { id },
      data: updateTemplateDto,
    });
  }

  remove(id: number) {
    return this.prisma.template.delete({ where: { id } });
  }
}
