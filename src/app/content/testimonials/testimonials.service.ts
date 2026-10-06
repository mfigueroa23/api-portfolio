import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../../mail/mail.service.js';
import { EmailLanguage } from '../../mail/templates/email-layout.js';
import { Prisma, Testimonial } from '../../../generated/prisma/client.js';
import {
  CreateTestimonialDto,
  UpdateTestimonialDto,
} from './dto/testimonials.dto.js';
import { TestimonialSubmission } from './interfaces/testimonial-submission.interface.js';
import {
  testimonialEmailHtml,
  testimonialEmailSubject,
  testimonialEmailText,
} from './templates/testimonial-email.js';

// What public reads return: an allowlist, so the visitor's email and the
// review fields can never reach the site.
const PUBLIC_SELECT = {
  id: true,
  position: true,
  quote: true,
  author: true,
  role: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TestimonialSelect;

export type PublicTestimonial = Prisma.TestimonialGetPayload<{
  select: typeof PUBLIC_SELECT;
}>;

@Injectable()
export class TestimonialsService {
  private readonly logger = new Logger(TestimonialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // Display order set by the owner; id breaks ties so the order is stable.
  listApproved(): Promise<PublicTestimonial[]> {
    return this.prisma.testimonial.findMany({
      where: { status: 'approved' },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: PUBLIC_SELECT,
    });
  }

  // Two queries: approved items may also have a submission date, so a single
  // sort could not keep them in display order after the pending ones.
  async listAll(): Promise<Testimonial[]> {
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
    return [...pending, ...approved];
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

  // Never changes `status` or `email`: a pending item stays pending. A missing
  // id makes Prisma throw P2025, which the filter turns into 404.
  update(id: number, dto: UpdateTestimonialDto): Promise<Testimonial> {
    return this.prisma.testimonial.update({
      where: { id },
      data: { ...this.values(dto), position: dto.position },
    });
  }

  // Stores the reviewed values, deletes the visitor's email and shows the item
  // first. Approving an approved item changes nothing.
  approve(id: number, dto: UpdateTestimonialDto): Promise<Testimonial> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.testimonial.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Not found.');
      if (current.status === 'approved') return current;
      await this.placeFirst(tx);
      return tx.testimonial.update({
        where: { id },
        data: {
          ...this.values(dto),
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

  // Stores a visitor's submission for review, then tells the owner. Pending
  // items never expire; they stay until approved or rejected.
  async submit(
    submission: TestimonialSubmission,
    language: EmailLanguage,
  ): Promise<void> {
    const { name, role, email, testimonial } = submission;
    const stored = await this.prisma.testimonial.create({
      data: {
        status: 'pending',
        position: null,
        author: name,
        role,
        quote: testimonial,
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

  // The owner-editable fields; a missing photo is stored as null.
  private values(dto: CreateTestimonialDto) {
    return {
      quote: dto.quote,
      author: dto.author,
      role: dto.role,
      avatar: dto.avatar ?? null,
    };
  }
}
