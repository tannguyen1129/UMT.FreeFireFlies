import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lấy các vai trò được yêu cầu (ví dụ: ['admin']) từ @Roles decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu endpoint không yêu cầu vai trò gì, cho qua
    if (!requiredRoles) {
      return true;
    }

    // Lấy thông tin user từ JWT (đã được JwtStrategy giải mã)
    const { user } = context.switchToHttp().getRequest();

    // Kiểm tra xem user có vai trò nào khớp với vai trò được yêu cầu không
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}