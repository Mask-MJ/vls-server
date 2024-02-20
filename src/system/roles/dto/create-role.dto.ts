import { IsString, IsNumber } from 'class-validator';

export class CreateRoleDto {
  /**
   * 角色名称
   * @example '管理员'
   */
  @IsString()
  name: string;

  /**
   * 角色状态 0: 关闭 1: 开启
   * @example 1
   */
  @IsNumber()
  status?: number = 1;

  /**
   * 排序
   * @example 1
   */
  @IsNumber()
  sort?: number = 1;

  /**
   * 角色角色关键字
   * @example 'admin'
   */
  @IsString()
  roleKey: string;

  /**
   * 角色描述
   * @example '这是一个角色'
   */
  @IsString()
  remark?: string = '';

  /**
   * 菜单id
   * @example [1, 2, 3]
   */
  @IsNumber({}, { each: true, message: '菜单必须是数字' })
  menus?: number[] = [];
}
