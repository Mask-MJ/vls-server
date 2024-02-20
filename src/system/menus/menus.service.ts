import { Injectable } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class MenusService {
  constructor(private prisma: PrismaService) {}

  async create(createMenuDto: CreateMenuDto) {
    const existingMenu = await this.prisma.menu.findUnique({
      where: { name: createMenuDto.name },
    });
    if (existingMenu) {
      throw new Error('菜单名称已存在');
    }
    return await this.prisma.menu.create({
      data: {
        ...createMenuDto,
        roles: { connect: createMenuDto.roles?.map((id) => ({ id })) },
      },
    });
  }

  findAll() {
    return this.prisma.menu.findMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} menu`;
  }

  update(id: number, updateMenuDto: UpdateMenuDto) {
    return this.prisma.menu.update({
      where: { id },
      data: {
        ...updateMenuDto,
        roles: { set: updateMenuDto.roles?.map((id) => ({ id })) },
      },
    });
  }

  remove(id: number) {
    return this.prisma.menu.delete({ where: { id } });
  }
}
