import { Controller, Get, Post, Put, Body, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { FormDataService } from './form-data.service';
import { SubmitFormDataDto } from './dto/submit-form-data.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller(['api/form-data', 'form-data'])
export class FormDataController {
  constructor(private readonly formDataService: FormDataService) {}

  private actor(req: any): { userId: string; userName: string } {
    const userId = String(req.user?.id ?? req.user?.userId ?? 'default-user');
    const userName = req.user?.name || req.user?.account || '默认用户';
    return { userId, userName };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async submit(@Body() submitDto: SubmitFormDataDto, @Req() req: any) {
    const { userId, userName } = this.actor(req);
    return this.formDataService.submit(submitDto, userId, userName);
  }

  @Get('form/:formId')
  @UseGuards(JwtAuthGuard)
  async findAllByForm(@Param('formId') formId: string, @Req() req: any) {
    const { userId } = this.actor(req);
    return this.formDataService.findAll(formId, { userId });
  }

  @Get('form/:formId/paged')
  @UseGuards(JwtAuthGuard)
  async findPagedByForm(
    @Param('formId') formId: string,
    @Req() req: any,
  ) {
    const { userId } = this.actor(req);
    const page = req.query?.page ? parseInt(String(req.query.page), 10) : 1;
    const pageSize = req.query?.pageSize ? parseInt(String(req.query.pageSize), 10) : 20;
    return this.formDataService.findPaged(formId, { page, pageSize }, { userId });
  }

  @Get(':recordId')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('recordId') recordId: string, @Req() req: any) {
    const { userId } = this.actor(req);
    return this.formDataService.findOne(recordId, { userId });
  }

  @Put(':recordId')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('recordId') recordId: string,
    @Body() updateDto: Partial<SubmitFormDataDto>,
    @Req() req: any,
  ) {
    const { userId, userName } = this.actor(req);
    return this.formDataService.update(recordId, updateDto, userId, userName);
  }

  @Delete(':recordId')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('recordId') recordId: string, @Req() req: any) {
    const { userId, userName } = this.actor(req);
    return this.formDataService.remove(recordId, userId, userName);
  }
}
