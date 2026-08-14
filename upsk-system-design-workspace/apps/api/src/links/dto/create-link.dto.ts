import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const SCHEME_RE = /^https?:\/\//;
const ENCODED_SLASH = /%2[fF]/;

@ValidatorConstraint({ name: 'SafeHttpUrl', async: false })
export class SafeHttpUrl implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) return false;

    if (value !== value.trim()) return false;

    if (CONTROL_CHARACTERS.test(value)) return false;

    if (value.includes('\\')) return false;

    const schemeMatch = SCHEME_RE.exec(value);
    if (!schemeMatch) return false;

    if (ENCODED_SLASH.test(value)) return false;

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return false;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    if (!parsed.hostname) return false;

    if (parsed.username || parsed.password) return false;

    return true;
  }

  defaultMessage(): string {
    return 'long_url must be a valid lowercase http(s) URL without whitespace, control characters, backslashes, embedded credentials, or encoded slashes';
  }
}

export class CreateLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Validate(SafeHttpUrl)
  long_url: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];
}
