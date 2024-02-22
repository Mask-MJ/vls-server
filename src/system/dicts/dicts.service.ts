import { Injectable } from '@nestjs/common';
import { CreateDictDto } from './dto/create-dict.dto';
import { UpdateDictDto } from './dto/update-dict.dto';
import { PrismaService } from 'nestjs-prisma';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { QueryDictDto } from './dto/query-dict.dto';

@Injectable()
export class DictsService {
  constructor(private prisma: PrismaService) {}

  create(createDictDto: CreateDictDto) {
    return this.prisma.dict.create({ data: createDictDto });
  }

  findAll(paginationQueryDto: PaginationQueryDto, queryDictDto: QueryDictDto) {
    const { page, pageSize } = paginationQueryDto;
    const { name, templateId } = queryDictDto;
    return this.prisma.dict.findMany({
      take: pageSize,
      skip: (page - 1) * pageSize,
      where: {
        name: { contains: name },
        templateId,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.dict.findUniqueOrThrow({ where: { id } });
  }

  update(id: number, updateDictDto: UpdateDictDto) {
    return this.prisma.dict.update({ where: { id }, data: updateDictDto });
  }

  remove(id: number) {
    return this.prisma.dict.delete({ where: { id } });
  }
}
