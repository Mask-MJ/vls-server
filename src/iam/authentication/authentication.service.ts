import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../config/jwt.config';
import { ConfigType } from '@nestjs/config';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  RefreshTokenIdsStorage,
  InvalidatedRefreshTokenError,
} from './refresh-token-ids.storage';
import { HashingService } from '../hashing/hashing.service';
import { PrismaService } from 'nestjs-prisma';
import { User } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashingService: HashingService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly refreshTokenIdsStorage: RefreshTokenIdsStorage,
  ) {}

  // 生成 access token 传入 用户 id, 过期时间, payload
  private async signToken<T>(userId: number, expiresIn: number, payload?: T) {
    return await this.jwtService.signAsync(
      { sub: userId, ...payload },
      { secret: this.jwtConfiguration.secret, expiresIn },
    );
  }

  async signUp({ account, nickname, password }: SignUpDto): Promise<User> {
    try {
      // 判断数据库是否有数据
      // 如果不存在则创建第一个用户为管理员

      // 判断用户名是否存在
      if (await this.prisma.user.findUnique({ where: { account } })) {
        throw new ConflictException('用户名已存在');
      }
      return this.prisma.user.create({
        data: {
          account: account,
          password: await this.hashingService.hash(password),
          nickname: nickname,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async signIn(signInDto: SignInDto) {
    const user = await this.prisma.user.findUnique({
      where: { account: signInDto.account },
    });
    if (!user) {
      throw new UnauthorizedException('用户名不存在');
    }
    const isEquals = await this.hashingService.compare(
      signInDto.password,
      user.password,
    );
    if (!isEquals) {
      throw new UnauthorizedException('密码错误');
    }

    // 生成 access token
    return await this.generateTokens(user);
  }

  async generateTokens(user: User) {
    // 生成随机 id
    const refreshTokenId = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.signToken<Partial<ActiveUserData>>(
        user.id,
        this.jwtConfiguration.accessTokenTtl,
        {
          account: user.account,
          nickname: user.nickname || '',
        },
      ),
      this.signToken(user.id, this.jwtConfiguration.refreshTokenTtl, {
        refreshTokenId,
      }),
    ]);
    await this.refreshTokenIdsStorage.insert(user.id, refreshTokenId);
    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    try {
      // 验证传入的刷新令牌 获取用户id
      const { sub, refreshTokenId } = await this.jwtService.verifyAsync<
        Pick<ActiveUserData, 'sub'> & { refreshTokenId: string }
      >(refreshTokenDto.refreshToken, { secret: this.jwtConfiguration.secret });
      // 获取用户实例
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: sub },
      });
      // 验证刷新令牌是否有效
      const isValid = await this.refreshTokenIdsStorage.validate(
        user.id,
        refreshTokenId,
      );
      if (isValid) {
        await this.refreshTokenIdsStorage.invalidate(user.id);
      } else {
        throw new Error('Refresh token 已过期');
      }
      return this.generateTokens(user);
    } catch (error) {
      if (error instanceof InvalidatedRefreshTokenError) {
        throw new UnauthorizedException('Access token 已过期');
      }
      throw new UnauthorizedException();
    }
  }
}
