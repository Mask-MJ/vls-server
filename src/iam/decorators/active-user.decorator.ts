import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { REQUEST_USER_KEY } from '../iam.constants';

export const ActiveUser = createParamDecorator(
  (field: keyof ActiveUserData, ctx: ExecutionContext) => {
    // 从执行上下文中获取请求对象
    // 切换到 http 并且调用 getRequest 方法
    const request = ctx.switchToHttp().getRequest();
    // 从请求对象中获取用户对象
    const user: ActiveUserData | undefined = request[REQUEST_USER_KEY];
    // 如果没有传入字段，则返回整个用户对象
    return field ? user?.[field] : user;
  },
);
