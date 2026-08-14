import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { SafeHttpUrl } from './create-link.dto';

export class UpdateLinkDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Validate(SafeHttpUrl)
  long_url?: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string | null;
}