import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

//Generic FS dtos
export class FSNodeDTO {
  @ApiProperty({ description: 'Name of the directory/file', example: 'file.txt', required: true })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Path of the directory/file', example: '/folder/subfolder/file.txt', required: true })
  @IsString()
  path: string;

  @ApiProperty({ description: 'Type of the directory/file', example: 'file', required: true })
  @IsEnum(['file', 'dir'])
  type: 'file' | 'dir';

  @ApiProperty({ description: 'Size', example: 1024, required: true })
  @IsNumber()
  size: number;

  @ApiProperty({ description: 'Last access of the directory/file', example: '2022-01-01T00:00:00.000Z', required: true })
  @IsString()
  lastAccess: string;

  @ApiProperty({ description: 'Last update of the directory/file content', example: '2022-01-01T00:00:00.000Z', required: true })
  @IsString()
  lastUpdate: string;

  @ApiProperty({ description: 'Last modified of the directory/file metadata', example: '2022-01-01T00:00:00.000Z', required: true })
  @IsString()
  lastMod: string;

  @ApiProperty({ description: 'Only for directories', example: [], required: true })
  @IsArray()
  @IsOptional()
  childs?: FSNodeDTO[];
}

//Controllers/Services dtos
export class FSGetNodeDTO {
  @ApiProperty({ description: 'Path to get file/directory', example: '/folder/subfolder/file.txt', required: false })
  @IsString()
  @IsOptional()
  path?: string = '/';

  @ApiProperty({ description: 'Recursive (only for directories)', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value?.toLowerCase() === 'true') return true;
    if (value?.toLowerCase() === 'false') return false;
    return value;
  })
  recursive?: boolean = false;
}

export class FSGetDirDTO {
  @ApiProperty({ description: 'Path to list', example: '/folder/subfolder', required: false })
  @IsString()
  @IsOptional()
  path?: string = '/';

  @ApiProperty({ description: 'Recursive', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value?.toLowerCase() === 'true') return true;
    if (value?.toLowerCase() === 'false') return false;
    return value;
  })
  recursive?: boolean = false;
}

export class FSCreateDirDTO {
  @ApiProperty({ description: 'Path to create', example: '/folder/subfolder', required: true })
  @IsString()
  path: string;

  @ApiProperty({ description: 'Ensure parent directories', required: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  ensureParent?: boolean = false;
}

export class FSDeleteNodeDTO {
  @ApiProperty({ description: 'Path to delete', example: '/folder/subfolder', required: true })
  @IsString()
  path: string;

  @ApiProperty({ description: 'Necessary to delete non-empty directories', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value?.toLowerCase() === 'true') return true;
    if (value?.toLowerCase() === 'false') return false;
    return value;
  })
  recursive?: boolean = false;
}

export class FSRenameNodeDTO {
  @ApiProperty({ description: 'Path to rename', example: '/folder/subfolder1', required: true })
  @IsString()
  path: string;

  @ApiProperty({ description: 'New path', example: '/folder/subfolder2', required: true })
  @IsString()
  newPath: string;
}

export class FSCreateFileDTO {
  @ApiProperty({ description: 'Path to create', example: '/folder/subfolder', required: true })
  @IsString()
  path: string;

  @ApiProperty({ description: 'File content', required: true })
  @IsString()
  data: string;
}