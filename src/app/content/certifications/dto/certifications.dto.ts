import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { DATE_PATTERN } from '../../common/calendar-dates.js';
import { EmptyToNull, HTTP_URL_OPTIONS } from '../../common/dto-transforms.js';

const DATE_MESSAGE = 'must be a date as YYYY-MM-DD';

// Field error on expiryDate when it falls before issueDate. Both are
// YYYY-MM-DD, so comparing the strings compares the dates.
@ValidatorConstraint({ name: 'expiryNotBeforeIssue' })
export class ExpiryNotBeforeIssue implements ValidatorConstraintInterface {
  validate(expiryDate: unknown, args: ValidationArguments): boolean {
    const { issueDate } = args.object as { issueDate?: unknown };
    if (typeof expiryDate !== 'string' || typeof issueDate !== 'string') {
      return true;
    }
    return expiryDate >= issueDate;
  }

  defaultMessage(): string {
    return 'expiryDate must not be earlier than issueDate';
  }
}

// Used for create and for update (PUT replaces the whole item). Dates are
// calendar dates without time zone; unknown fields are stripped.
export class CertificationDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  issuer: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: `issueDate ${DATE_MESSAGE}` })
  @IsISO8601({ strict: true }, { message: `issueDate ${DATE_MESSAGE}` })
  issueDate: string;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: `expiryDate ${DATE_MESSAGE}` })
  @IsISO8601({ strict: true }, { message: `expiryDate ${DATE_MESSAGE}` })
  @Validate(ExpiryNotBeforeIssue)
  expiryDate?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  credentialId?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(500)
  verificationUrl?: string | null;

  @EmptyToNull()
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(500)
  fileUrl?: string | null;
}
