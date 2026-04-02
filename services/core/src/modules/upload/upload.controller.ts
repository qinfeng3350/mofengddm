import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** multer 在部分环境下会把 UTF-8 文件名当成 latin1，响应里做一次修正 */
function decodeOriginalFilename(name?: string): string | undefined {
  if (!name) return undefined;
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

const UPLOAD_SUBDIR = join('data', 'uploads');

function uploadRoot(): string {
  return join(process.cwd(), UPLOAD_SUBDIR);
}

function ensureUploadDir(): void {
  const dir = uploadRoot();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** multer 注入的文件对象（不显式依赖 @types/multer） */
type UploadedMultipartFile = {
  buffer?: Buffer;
  path?: string;
  mimetype?: string;
  originalname?: string;
};

/** 附件字段常见类型（含 txt/csv/Office；浏览器可能报 octet-stream，见下方扩展名兜底） */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
]);

const ALLOWED_EXT = new Set([
  '.txt',
  '.csv',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.zip',
]);

@Controller('api/uploads')
export class UploadController {
  /**
   * 上传文件（需登录）；文件落地到服务目录 data/uploads，返回可访问 URL
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file?: UploadedMultipartFile) {
    let buffer: Buffer | undefined = file?.buffer;
    if ((!buffer || !buffer.length) && file?.path) {
      try {
        buffer = await readFile(file.path);
      } finally {
        try {
          await unlink(file.path);
        } catch {
          // ignore
        }
      }
    }
    if (!buffer?.length) {
      throw new BadRequestException('请选择要上传的文件');
    }
    const mime = (file?.mimetype || 'application/octet-stream').toLowerCase();
    const rawName = decodeOriginalFilename(file?.originalname) || file?.originalname || '';
    const ext = extname(rawName).toLowerCase();
    const mimeOk = ALLOWED_MIME.has(mime);
    const extOk = ext && ALLOWED_EXT.has(ext);
    // 部分浏览器对 txt/Office 会报 application/octet-stream，用扩展名兜底
    const octet = mime === 'application/octet-stream' || mime === 'binary/octet-stream';
    if (!mimeOk && !(octet && extOk) && !extOk) {
      throw new BadRequestException(
        '不支持该文件类型，请上传图片、PDF、文本或常见 Office 文档',
      );
    }

    ensureUploadDir();
    const safeExt = ext && ext.length <= 8 ? ext : '';
    const storedName = `${Date.now()}-${randomBytes(8).toString('hex')}${safeExt}`;
    const absPath = join(uploadRoot(), storedName);
    await writeFile(absPath, buffer);

    const url = `/api/uploads/files/${storedName}`;
    return {
      success: true,
      url,
      originalName: decodeOriginalFilename(file?.originalname),
    };
  }

  /**
   * 公开读取已上传文件（通过不可猜测的文件名保护；用于 img src 无法带 JWT）
   */
  @Get('files/:name')
  async getFile(@Param('name') name: string, @Res({ passthrough: false }) res: Response) {
    if (!name || name.includes('..') || !/^[\w.-]+$/.test(name)) {
      throw new NotFoundException();
    }
    const absPath = join(uploadRoot(), name);
    if (!existsSync(absPath)) {
      throw new NotFoundException();
    }
    return res.sendFile(absPath);
  }
}
