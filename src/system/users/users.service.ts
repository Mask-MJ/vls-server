import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'nestjs-prisma';
import { HashingService } from 'src/iam/hashing/hashing.service';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { QueryUserDto } from './dto/query-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashingService: HashingService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { account: createUserDto.account },
    });
    if (existingUser) {
      throw new ConflictException('账号已存在');
    }
    return await this.prisma.user.create({
      data: {
        account: createUserDto.account,
        password: await this.hashingService.hash(createUserDto.password),
        nickname: createUserDto.nickname,
        roles: { connect: createUserDto.roles?.map((id) => ({ id })) },
      },
    });
  }

  findAll(paginationQueryDto: PaginationQueryDto, queryUserDto: QueryUserDto) {
    const { page, pageSize } = paginationQueryDto;
    const { account, nickname, roles, status, beginTime, endTime } =
      queryUserDto;
    return this.prisma.user.findMany({
      take: pageSize,
      skip: (page - 1) * pageSize,
      where: {
        account: { contains: account },
        nickname: { contains: nickname },
        roles: { some: { id: { in: roles } } },
        status: status,
        createdAt: { gte: beginTime, lte: endTime },
      },
      include: { roles: true },
    });
  }

  async findSelf(id: number) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { roles: true },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { roles: true },
    });

    return {
      ...user,
      password: undefined,
      roles: user.roles.map((role) => role.id),
    };
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        roles: {
          connect: updateUserDto.roles?.map((roleId) => ({ id: roleId })),
        },
      },
    });
  }

  remove(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }
}
