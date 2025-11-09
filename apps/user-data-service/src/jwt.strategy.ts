import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Yêu cầu token phải được gửi trong Header dạng 'Bearer <token>'
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'MY_SECRET_KEY',
    });
  }

  /**
   * Hàm này sẽ tự động chạy sau khi token được xác thực là hợp lệ
   * Payload chính là cái chúng ta đã nhét vào ở auth-service
   */
  async validate(payload: any) {
    // payload = { sub: user.user_id, email: user.email, roles: [...] }
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}