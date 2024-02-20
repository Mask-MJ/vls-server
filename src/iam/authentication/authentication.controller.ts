import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { Auth } from './decorators/auth.decorator';
import { AuthType } from './enums/auth-type.enum';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/iam/authorization/decorators/roles.decorator';

@ApiTags('登录认证')
@Auth(AuthType.None)
@Roles()
@Controller('authentication')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Post('sign-up')
  @ApiOperation({ summary: '注册' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '注册成功' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: '用户名已存在' })
  signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('sign-in')
  @ApiOperation({ summary: '登录' })
  @ApiResponse({ status: HttpStatus.OK, description: '登录成功' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '用户名或密码错误',
  })
  async signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh-token')
  @ApiOperation({ summary: '刷新令牌' })
  @ApiResponse({ status: HttpStatus.OK, description: '刷新成功' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '令牌无效' })
  refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto);
  }
}
