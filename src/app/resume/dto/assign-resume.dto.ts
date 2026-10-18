import { IsUUID } from 'class-validator';

// A file already in the library (uploaded with POST /files).
export class AssignResumeDto {
  @IsUUID()
  fileId: string;
}
