import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserEntity, TenantEntity } from '../../database/entities';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(TenantEntity)
    private tenantRepository: Repository<TenantEntity>,
    private jwtService: JwtService,
  ) {}

  private buildUserDto(user: UserEntity, tenant: TenantEntity) {
    return {
      id: user.id,
      account: user.account,
      name: user.name,
      email: user.email,
      phone: user.phone,
      tenantId: user.tenantId,
      tenant: {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
      },
    };
  }

  private buildTokenPayload(user: UserEntity) {
    return {
      sub: user.id,
      account: user.account,
      tenantId: user.tenantId,
    };
  }

  async register(registerDto: RegisterDto) {
    // 检查账号是否已存在
    const existingUser = await this.userRepository.findOne({
      where: { account: registerDto.account },
    });

    if (existingUser) {
      throw new ConflictException('账号已存在');
    }

    // 检查邮箱是否已存在
    if (registerDto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: registerDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('邮箱已被使用');
      }
    }

    // 获取默认租户
    const defaultTenant = await this.tenantRepository.findOne({
      where: { code: 'default' },
    });

    if (!defaultTenant) {
      throw new Error('默认租户不存在，请先初始化数据库');
    }

    // 加密密码
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    // 创建用户
    const user = this.userRepository.create({
      account: registerDto.account,
      name: registerDto.name,
      email: registerDto.email,
      phone: registerDto.phone,
      passwordHash,
      tenantId: defaultTenant.id,
      status: 1,
    });

    const savedUser = await this.userRepository.save(user);

    // 生成JWT token
    const payload = {
      sub: savedUser.id,
      account: savedUser.account,
      tenantId: savedUser.tenantId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: savedUser.id,
        account: savedUser.account,
        name: savedUser.name,
        email: savedUser.email,
        phone: savedUser.phone,
      },
    };
  }

  async login(loginDto: LoginDto) {
    console.log('[AuthService] 登录请求:', { account: loginDto.account });
    
    // 查找用户（支持账号或手机号登录）
    let user = await this.userRepository.findOne({
      where: { account: loginDto.account },
    });

    // 如果账号不存在，尝试使用手机号登录
    if (!user) {
      user = await this.userRepository.findOne({
        where: { phone: loginDto.account },
      });
    }

    if (!user) {
      console.log('[AuthService] 用户不存在:', loginDto.account);
      throw new UnauthorizedException('账号或密码错误');
    }

    console.log('[AuthService] 找到用户:', { id: user.id, account: user.account, status: user.status });

    // 验证密码
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    console.log('[AuthService] 密码验证结果:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('[AuthService] 密码验证失败');
      throw new UnauthorizedException('账号或密码错误');
    }

    // 检查用户状态
    if (user.status !== 1) {
      console.log('[AuthService] 用户状态被禁用:', user.status);
      throw new UnauthorizedException('账号已被禁用');
    }

    // 生成JWT token
    const payload = {
      sub: user.id,
      account: user.account,
      tenantId: user.tenantId,
    };

    const token = this.jwtService.sign(payload);
    console.log('[AuthService] 登录成功，生成token');

    return {
      access_token: token,
      user: {
        id: user.id,
        account: user.account,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    };
  }

  async validateUser(userId: string): Promise<UserEntity | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || user.status !== 1) {
      return null;
    }

    return user;
  }

  async getTenantsByAccount(account: string): Promise<Array<{ id: string; code: string; name: string }>> {
    const users = await this.userRepository.find({
      where: { account },
      select: ['tenantId'],
    });

    const tenantIds = Array.from(
      new Set(
        users
          .map((u) => u.tenantId)
          .filter((id): id is string => !!id),
      ),
    );

    if (tenantIds.length === 0) {
      throw new BadRequestException('当前账号没有可切换的租户');
    }

    const tenants = await this.tenantRepository.find({
      where: { id: In(tenantIds) as any },
      select: ['id', 'code', 'name'],
    });

    return tenants.map((t) => ({ id: t.id, code: t.code, name: t.name }));
  }

  async switchTenant(account: string, tenantId: string): Promise<{ access_token: string; user: any }> {
    const targetUser = await this.userRepository.findOne({
      where: { account, tenantId },
    });

    if (!targetUser) {
      throw new BadRequestException('未找到该账号对应的目标租户用户');
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: targetUser.tenantId },
      select: ['id', 'code', 'name'],
    });

    if (!tenant) {
      throw new BadRequestException('目标租户不存在');
    }

    const payload = this.buildTokenPayload(targetUser);
    const token = this.jwtService.sign(payload);
    return {
      access_token: token,
      user: this.buildUserDto(targetUser, tenant),
    };
  }

  /**
   * 修改当前用户密码
   */
  async changePassword(
    userId: string,
    oldPassword: string | undefined,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 如果已有密码且传入了旧密码，则校验旧密码
    if (user.passwordHash && oldPassword) {
      const isOldPasswordValid = await bcrypt.compare(
        oldPassword,
        user.passwordHash,
      );

      if (!isOldPasswordValid) {
        throw new UnauthorizedException('原密码不正确');
      }
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    user.passwordHash = newPasswordHash;

    await this.userRepository.save(user);
  }
}

