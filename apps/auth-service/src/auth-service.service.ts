import { HttpException, HttpStatus, Injectable, UnauthorizedException, } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { RegisterUserDto } from './dto/register-user.dto';
import * as bcrypt from 'bcrypt';
import { Role } from './entities/role.entity';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthServiceService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Role) 
    private readonly roleRepository: Repository<Role>,

    private readonly jwtService: JwtService,
  ) {}

  /**
   * Xử lý logic đăng ký người dùng mới
   */
  async register(
    registerDto: RegisterUserDto,
  ): Promise<Omit<User, 'password_hash'>>  {
    // 1. Kiểm tra xem email đã tồn tại chưa
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new HttpException('Email đã tồn tại', HttpStatus.CONFLICT); // 409
    }

    // 2. Tìm vai trò "citizen" 
    const defaultRole = await this.roleRepository.findOne({
      where: { role_name: 'citizen' },
    });

    if (!defaultRole) {
      throw new HttpException(
        'Không tìm thấy vai trò mặc định',
        HttpStatus.INTERNAL_SERVER_ERROR, // 500
      );
    }

    // 3. Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(registerDto.password, salt);

    // 4. Tạo User mới
    const newUser = this.userRepository.create({
      full_name: registerDto.fullName,
      email: registerDto.email,
      password_hash: hashedPassword,
      roles: [defaultRole], 
    });

    // 5. Lưu vào CSDL
    const savedUser = await this.userRepository.save(newUser);

    // 6. Xóa mật khẩu trước khi trả về (Vì lý do bảo mật)
    const { password_hash, ...result } = savedUser; 
    return result;
  }

  async login(loginDto: LoginUserDto): Promise<{ access_token: string }> {
    // 1. Tìm người dùng bằng email
    // Chúng ta cần lấy cả password_hash để so sánh,
    // và roles để đưa vào token (nếu cần)
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
      relations: ['roles'], // 👈 Quan trọng: Lấy luôn thông tin roles
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng'); // 401
    }

    // 2. So sánh mật khẩu
    const isMatch = await bcrypt.compare(loginDto.password, user.password_hash);

    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng'); // 401
    }

    // 3. (Tùy chọn) Cập nhật last_login
    this.userRepository.update(user.user_id, { last_login: new Date() });

    // 4. Tạo JWT Payload
    const payload = {
      sub: user.user_id, 
      email: user.email,
      roles: user.roles.map((role) => role.role_name), 
    };

    // 5. Ký và trả về token
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}

