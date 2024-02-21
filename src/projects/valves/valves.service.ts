import { Injectable } from '@nestjs/common';
import { CreateValveDto } from './dto/create-valve.dto';
import { UpdateValveDto } from './dto/update-valve.dto';
import { PrismaService } from 'nestjs-prisma';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { QueryValveDto } from './dto/query-valve.dto';
import { ActiveUserData } from 'src/iam/interfaces/active-user-data.interface';

@Injectable()
export class ValvesService {
  constructor(private prisma: PrismaService) {}

  create(user: ActiveUserData, createValveDto: CreateValveDto) {
    return this.prisma.valve.create({
      data: {
        ...createValveDto,
        createrId: user.sub,
      },
    });
  }

  findAll(
    paginationQueryDto: PaginationQueryDto,
    queryValveDto: QueryValveDto,
  ) {
    const { page, pageSize } = paginationQueryDto;
    const { name, factoryId, status } = queryValveDto;
    return this.prisma.valve.findMany({
      take: pageSize,
      skip: (page - 1) * pageSize,
      where: {
        name: { contains: name },
        factoryId,
        status,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.valve.findUniqueOrThrow({ where: { id } });
  }

  update(id: number, updateValveDto: UpdateValveDto) {
    return this.prisma.valve.update({ where: { id }, data: updateValveDto });
  }

  remove(id: number) {
    return this.prisma.valve.delete({ where: { id } });
  }
}
