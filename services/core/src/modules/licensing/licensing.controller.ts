import { Body, Controller, Headers, Param, Post, ForbiddenException } from '@nestjs/common';
import { LicensingService } from './licensing.service';
import type { LicenseDuration } from './license-codec';

type GenerateLicenseBody = {
  duration: LicenseDuration;
  enabled?: boolean;
  tenantName?: string;
  maxEnabledUsers?: number;
  maxForms?: number;
  maxRecords?: number;
};

type ProvisionBody = {
  licenseKey: string;
  adminAccount: string;
  adminName: string;
  adminPassword: string;
};

function readRequiredSecret(headerValue: string | undefined, expected: string | undefined, errorMsg: string) {
  if (!expected) {
    throw new ForbiddenException(errorMsg + ': 服务端未配置对应 secret');
  }
  if (!headerValue || headerValue !== expected) {
    throw new ForbiddenException(errorMsg);
  }
}

@Controller('api/licenses')
export class LicensingController {
  constructor(private readonly licensingService: LicensingService) {}

  @Post('generate')
  async generate(@Body() body: GenerateLicenseBody, @Headers('x-admin-secret') adminSecret?: string) {
    readRequiredSecret(
      adminSecret,
      process.env.LICENSE_ADMIN_SECRET,
      '未授权：LICENSE_ADMIN_SECRET 不匹配',
    );

    const data = this.licensingService.generateLicenseKey(body);
    return { success: true, data };
  }

  @Post('provision')
  async provision(@Body() body: ProvisionBody, @Headers('x-install-secret') installSecret?: string) {
    readRequiredSecret(
      installSecret,
      process.env.LICENSE_INSTALL_SECRET,
      '未授权：LICENSE_INSTALL_SECRET 不匹配',
    );

    const data = await this.licensingService.provisionFromLicenseKey(body);
    return { success: true, data };
  }

  @Post('admin/tenants')
  async adminListTenants(@Headers('x-admin-secret') adminSecret?: string) {
    readRequiredSecret(
      adminSecret,
      process.env.LICENSE_ADMIN_SECRET,
      '未授权：LICENSE_ADMIN_SECRET 不匹配',
    );
    const data = await this.licensingService.adminListTenants();
    return { success: true, data };
  }

  @Post('admin/tenants/:tenantId/limits')
  async adminUpdateTenantLimits(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      enabled?: boolean;
      expiresAt?: string | null;
      maxEnabledUsers?: number | null;
      maxForms?: number | null;
      maxRecords?: number | null;
    },
    @Headers('x-admin-secret') adminSecret?: string,
  ) {
    readRequiredSecret(
      adminSecret,
      process.env.LICENSE_ADMIN_SECRET,
      '未授权：LICENSE_ADMIN_SECRET 不匹配',
    );
    const data = await this.licensingService.adminUpdateTenantLimits(tenantId, body);
    return { success: true, data };
  }
}

