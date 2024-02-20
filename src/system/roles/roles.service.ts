import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PrismaService } from 'nestjs-prisma';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { QueryRoleDto } from './dto/query-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto) {
    const existingRoleKey = await this.prisma.role.findUnique({
      where: { roleKey: createRoleDto.roleKey },
    });
    if (existingRoleKey) {
      throw new NotFoundException('角色键已存在');
    }
    return await this.prisma.role.create({
      data: {
        ...createRoleDto,
        menus: {
          connect: createRoleDto.menus?.map((id) => ({ id })),
        },
      },
    });
  }

  async findAll(
    paginationQueryDto: PaginationQueryDto,
    queryRoleDto: QueryRoleDto,
  ) {
    const { page, pageSize } = paginationQueryDto;
    const { name, status, roleKey } = queryRoleDto;
    const roles = await this.prisma.role.findMany({
      take: pageSize,
      skip: (page - 1) * pageSize,
      where: {
        name: { contains: name },
        status: status,
        roleKey: { contains: roleKey },
      },
      orderBy: { sort: 'asc' },
      include: { menus: true },
    });

    return roles.map((role) => {
      return {
        ...role,
        menus: role.menus.map((menu) => menu.id),
      };
    });
  }

  async findOne(id: number) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { id },
      include: { menus: { select: { id: true } } },
    });

    return {
      ...role,
      menus: role.menus.map((menu) => menu.id),
    };
  }

  update(id: number, updateRoleDto: UpdateRoleDto) {
    return this.prisma.role.update({
      where: { id },
      data: {
        ...updateRoleDto,
        menus: {
          connect: updateRoleDto.menus?.map((menuId) => ({ id: menuId })),
        },
      },
    });
  }

  remove(id: number) {
    return this.prisma.role.delete({ where: { id } });
  }
}
