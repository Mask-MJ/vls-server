import { IsNumber, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  /**
   * 账号
   * @example 'admin'
   */
  @IsString()
  @MinLength(4)
  account: string;

  /**
   * 密码
   * @example '123456'
   */
  @IsString()
  @MinLength(4)
  password: string;

  /**
   * 昵称
   * @example '管理员'
   */
  @IsString()
  nickname?: string = '';

  /**
   * 角色
   * @example [1, 2, 3]
   */
  @IsNumber({}, { each: true, message: '角色必须是数字' })
  roles?: number[] = [];

  /**
   * 状态 0: 禁用 1: 启用
   * @example 1
   */
  @IsNumber()
  status?: number = 1;
}
