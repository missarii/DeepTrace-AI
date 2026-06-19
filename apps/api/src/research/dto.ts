import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateResearchDto {
  @IsString() projectId?: string;
  @IsString() @MaxLength(2000) question!: string;
  @IsIn(['quick', 'standard', 'comprehensive']) depth?: 'quick' | 'standard' | 'comprehensive' = 'standard';
  @IsOptional() @IsArray() @ArrayMaxSize(10) objectives?: string[];
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsArray() sourceTypes?: string[];
  @IsOptional() @IsString() language?: string = 'en';
  @IsOptional() @IsInt() @Min(30) @Max(3600) maxSeconds?: number = 600;
  @IsOptional() @IsInt() @Min(1) @Max(50) searchBudget?: number = 16;
  @IsOptional() @IsArray() includeDomains?: string[];
  @IsOptional() @IsArray() excludeDomains?: string[];
  @IsOptional() @IsString() idempotencyKey?: string;
  @IsOptional() @IsBoolean() demo?: boolean;
}

export class RetryDto { @IsOptional() @IsString() reason?: string; }
