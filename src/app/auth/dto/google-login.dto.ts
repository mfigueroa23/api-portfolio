import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  // Google ID token issued to the panel by Google Identity Services.
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  credential: string;
}
