import { Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/departments')
@UseGuards(JwtAuthGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  async getDepartments(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    const departments = await this.departmentService.findAll(tenantId);
    const tree = this.departmentService.buildTree(departments);
    return {
      success: true,
      data: departments,
      tree,
    };
  }

  @Post()
  async createDepartment(@Body() body: any, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    const result = await this.departmentService.create({
      tenantId,
      name: body.name,
      parentId: body.parentId,
      sortOrder: body.sortOrder,
      description: body.description,
    });
    return { success: true, data: result };
  }

  @Put(':id')
  async updateDepartment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    const result = await this.departmentService.update(id, tenantId, {
      name: body.name,
      parentId: body.parentId,
      sortOrder: body.sortOrder,
      description: body.description,
    });
    return { success: true, data: result };
  }

  @Delete(':id')
  async deleteDepartment(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    await this.departmentService.softDelete(id, tenantId);
    return { success: true };
  }
}

