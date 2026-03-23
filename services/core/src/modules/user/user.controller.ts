import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getUsers(@Query('keyword') keyword?: string, @Request() req?: any) {
    const tenantId = req.user?.tenantId;
    
    // 如果有关键词，进行搜索
    if (keyword) {
      const users = await this.userService.search(keyword, tenantId);
      return users.map(user => ({
        id: user.id,
        name: user.name,
        account: user.account,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        position: user.position,
        jobNumber: user.jobNumber,
        departmentId: user.departmentId,
        department: user.department ? {
          id: user.department.id,
          name: user.department.name,
        } : null,
        tenantId: user.tenantId,
      }));
    }
    
    // 否则返回所有用户
    const users = await this.userService.findAll(tenantId);
    return users.map(user => ({
      id: user.id,
      name: user.name,
      account: user.account,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      position: user.position,
      jobNumber: user.jobNumber,
      departmentId: user.departmentId,
      department: user.department ? {
        id: user.department.id,
        name: user.department.name,
      } : null,
      tenantId: user.tenantId,
    }));
  }
}

