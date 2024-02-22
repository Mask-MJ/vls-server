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
    return this.prisma.valve.create({ data: createValveDto });
  }

  async findAll(
    user: ActiveUserData,
    paginationQueryDto: PaginationQueryDto,
    queryValveDto: QueryValveDto,
  ) {
    const { page, pageSize } = paginationQueryDto;
    const { name, factoryId, status } = queryValveDto;
    const userInfo = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: { roles: true },
    });
    const hasAdmin = userInfo?.roles.some((role) => role.roleKey === 'admin');
    // 管理员可以查看所有阀门
    if (hasAdmin) {
      return this.prisma.valve.findMany({
        take: pageSize,
        skip: (page - 1) * pageSize,
        where: {
          name: { contains: name },
          factoryId,
          status,
        },
      });
    } else {
      // 查找用户所属工厂的阀门
      const factories = await this.prisma.factory.findMany({
        where: { users: { some: { id: user.sub } } },
        select: { id: true },
      });
      const factoryIds = factories.map((factory) => factory.id);
      return this.prisma.valve.findMany({
        take: pageSize,
        skip: (page - 1) * pageSize,
        where: {
          name: { contains: name },
          factoryId: { in: factoryIds },
          status,
        },
      });
    }
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
