import { INTERCEPTORS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import {
  HONEYPOT_REPLY,
  HoneypotInterceptor,
} from '../../common/interceptors/honeypot.interceptor.js';
import { TestimonialSubmissionsController } from './testimonial-submissions.controller.js';
import {
  TESTIMONIAL_INVALID_MESSAGE,
  TESTIMONIAL_LIMIT_MESSAGE,
  TESTIMONIAL_SUCCESS_MESSAGE,
} from './testimonials.constants.js';
import { TestimonialsService } from './testimonials.service.js';

const submission = {
  name: 'Ada',
  role: 'Engineer',
  email: 'ada@example.com',
  testimonial: 'Great.',
};

const handler = (): unknown =>
  Object.getOwnPropertyDescriptor(
    TestimonialSubmissionsController.prototype,
    'submit',
  )?.value;

describe('TestimonialSubmissionsController', () => {
  const submit = vi.fn();
  const controller = new TestimonialSubmissionsController({
    submit,
  } as unknown as TestimonialsService);

  beforeEach(() => {
    submit.mockReset().mockResolvedValue(undefined);
  });

  it('stores the submission in English and answers the success message', async () => {
    await expect(controller.submit(submission)).resolves.toEqual({
      message: TESTIMONIAL_SUCCESS_MESSAGE,
    });
    expect(submit).toHaveBeenCalledWith(submission, 'en');
  });

  it('stores a Spanish submission and answers in Spanish for lang=es', async () => {
    await expect(
      controller.submit(submission, { lang: 'es' }),
    ).resolves.toEqual({
      message: '¡Gracias! Tu testimonio aparecerá cuando haya sido revisado.',
    });
    expect(submit).toHaveBeenCalledWith(submission, 'es');
  });

  it('propagates service errors', async () => {
    submit.mockRejectedValue(new Error('boom'));

    await expect(controller.submit(submission)).rejects.toThrow('boom');
  });

  it('runs the honeypot with the success message as its reply', () => {
    expect(
      Reflect.getMetadata(INTERCEPTORS_METADATA, handler() as object),
    ).toEqual([HoneypotInterceptor]);
    expect(
      new Reflector().get<string>(HONEYPOT_REPLY, handler() as never),
    ).toBe(TESTIMONIAL_SUCCESS_MESSAGE);
  });

  it("uses the spec's texts", () => {
    expect(TESTIMONIAL_SUCCESS_MESSAGE).toBe(
      'Thanks! Your testimonial will appear once it has been reviewed.',
    );
    expect(TESTIMONIAL_INVALID_MESSAGE).toBe(
      'Please fill in all the fields with valid values.',
    );
    expect(TESTIMONIAL_LIMIT_MESSAGE).toBe(
      'Too many submissions. Please try again later.',
    );
  });
});
