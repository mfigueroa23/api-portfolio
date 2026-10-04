import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const FILE_KINDS = ['image', 'pdf'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

// The name is only for display (cut at 200 characters by the service).
export class UploadFileQueryDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class ListFilesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsIn(FILE_KINDS)
  type?: FileKind;
}
