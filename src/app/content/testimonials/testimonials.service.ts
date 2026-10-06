import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../../mail/mail.service.js';
import { EmailLanguage } from '../../mail/templates/email-layout.js';
import { Prisma, Testimonial } from '../../../generated/prisma/client.js';
import {
  CreateTestimonialDto,
  UpdateTestimonialDto,
} from './dto/testimonials.dto.js';
import type { Lang } from '../common/lang.js';
import {
  BILINGUAL_FIELDS,
  isTranslated,
  localize,
  Localized,
} from '../common/translation.js';
import { TestimonialSubmission } from './interfaces/testimonial-submission.interface.js';
import {
  testimonialEmailHtml,
  testimonialEmailSubject,
  testimonialEmailText,
} from './templates/testimonial-email.js';

// What public reads return: an allowlist, so the visitor's email and the
// review fields can never reach the site. The Spanish columns are read only to
// localize the item and are stripped by `localize`.
const PUBLIC_SELECT = {
  id: true,
  position: true,
  quote: true,
  quoteEs: true,
  author: true,
  role: true,
  roleEs: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TestimonialSelect;

const FIELDS = BILINGUAL_FIELDS.testimonials;
// English text every public testimonial must have (DB CHECK, RF-67).
const REQUIRED_ENGLISH = ['quote', 'role'] as const;

export type PublicTestimonial = Localized<
  Prisma.TestimonialGetPayload<{ select: typeof PUBLIC_SELECT }>,
  (typeof FIELDS)[number]
>;
export type AdminTestimonial = Testimonial & { translated: boolean };

// 400 with one field error per missing English value.
function assertEnglish(values: { quote: string | null; role: string | null }) {
  const fields: Record<string, string[]> = {};
  for (const field of REQUIRED_ENGLISH) {
    if (!values[field]?.trim()) {
      fields[field] = [`${field} is required in English to publish.`];
    }
  }
  if (Object.keys(fields).length > 0) {
    throw new BadRequestException({ error: 'Validation failed.', fields });
  }
}

@Injectable()
export class TestimonialsService {
  private readonly logger = new Logger(TestimonialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // Display order set by the owner; id breaks ties so the order is stable.
  async listApproved(lang: Lang = 'en'): Promise<PublicTestimonial[]> {
    const rows = await this.prisma.testimonial.findMany({
      where: { status: 'approved' },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: PUBLIC_SELECT,
    });
    return rows.map((row) => localize(row, FIELDS, lang));
  }

  // Two queries: approved items may also have a submission date, so a single
  // sort could not keep them in display order after the pending ones.
  async listAll(): Promise<AdminTestimonial[]> {
    const [pending, approved] = await Promise.all([
      this.prisma.testimonial.findMany({
        where: { status: 'pending' },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.testimonial.findMany({
        where: { status: 'approved' },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return [...pending, ...approved].map((row) => ({
      ...row,
      translated: isTranslated(row, FIELDS),
    }));
  }

  async pendingCount(): Promise<{ count: number }> {
    const count = await this.prisma.testimonial.count({
      where: { status: 'pending' },
    });
    return { count };
  }

  // Owner-created testimonials are public at once and shown first.
  create(dto: CreateTestimonialDto): Promise<Testimonial> {
    return this.prisma.$transaction(async (tx) => {
      await this.placeFirst(tx);
      return tx.testimonial.create({
        data: { ...this.values(dto), status: 'approved', position: 0 },
      });
    });
  }

  // Never changes `status` or `email`: a pending item stays pending. An
  // approved item keeps its English text. A missing id makes Prisma throw
  // P2025, which the filter turns into 404.
  async update(id: number, dto: UpdateTestimonialDto): Promise<Testimonial> {
    const current = await this.prisma.testimonial.findUnique({ where: { id } });
    const values = this.values(dto);
    if (current?.status === 'approved') assertEnglish(values);
    return this.prisma.testimonial.update({
      where: { id },
      data: { ...values, position: dto.position },
    });
  }

  // Stores the reviewed values, deletes the visitor's email and shows the item
  // first. Approving an approved item changes nothing.
  approve(id: number, dto: UpdateTestimonialDto): Promise<Testimonial> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.testimonial.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Not found.');
      if (current.status === 'approved') return current;
      const values = this.values(dto);
      assertEnglish(values);
      await this.placeFirst(tx);
      return tx.testimonial.update({
        where: { id },
        data: {
          ...values,
          status: 'approved',
          position: 0,
          email: null,
        },
      });
    });
  }

  // Also the rejection of a pending item: the row and its email are deleted.
  async remove(id: number): Promise<void> {
    await this.prisma.testimonial.delete({ where: { id } });
  }

  // Stores a visitor's submission for review, then tells the owner. The text
  // goes to the version of the page's language (RF-183, RF-184). Pending items
  // never expire; they stay until approved or rejected.
  async submit(
    submission: TestimonialSubmission,
    language: EmailLanguage,
  ): Promise<void> {
    const { name, role, email, testimonial } = submission;
    const spanish = language === 'es';
    const stored = await this.prisma.testimonial.create({
      data: {
        status: 'pending',
        position: null,
        author: name,
        role: spanish ? null : role,
        roleEs: spanish ? role : null,
        quote: spanish ? null : testimonial,
        quoteEs: spanish ? testimonial : null,
        avatar: null,
        email,
        language,
        submittedAt: new Date(),
      },
    });
    await this.notify(stored.id, { ...submission, language });
  }

  // A failed notification never fails the submission: the testimonial is kept
  // and marked so the panel shows "Notification not sent".
  private async notify(
    id: number,
    email: Parameters<typeof testimonialEmailHtml>[0],
  ): Promise<void> {
    try {
      await this.mail.send({
        senderName: 'Portfolio Testimonials',
        replyTo: { name: email.name, email: email.email },
        subject: testimonialEmailSubject(email),
        html: testimonialEmailHtml(email),
        text: testimonialEmailText(email),
      });
    } catch {
      // The error may echo the visitor's data, so only the id is logged.
      this.logger.warn(`Notification for testimonial ${id} was not sent`);
      await this.prisma.testimonial.update({
        where: { id },
        data: { notified: false },
      });
    }
  }

  // Shifts every approved item down one place, keeping their relative order,
  // so position 0 is free for the item being placed first.
  private async placeFirst(tx: Prisma.TransactionClient): Promise<void> {
    await tx.testimonial.updateMany({
      where: { status: 'approved' },
      data: { position: { increment: 1 } },
    });
  }

  // The owner-editable fields; empty optional values are stored as null.
  private values(dto: CreateTestimonialDto | UpdateTestimonialDto) {
    return {
      quote: dto.quote ?? null,
      quoteEs: dto.quoteEs ?? null,
      author: dto.author,
      role: dto.role ?? null,
      roleEs: dto.roleEs ?? null,
      avatar: dto.avatar ?? null,
    };
  }
}
