import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserDataServiceService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Lấy hồ sơ người dùng bằng ID
   */
  async getProfile(userId: string): Promise<Omit<User, 'password_hash'>> {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['roles'], // Lấy luôn thông tin roles
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Xóa mật khẩu trước khi trả về
    const { password_hash, ...result } = user;
    return result;
  }
}