// A visitor's submission after validation (SubmitTestimonialDto without the
// honeypot field).
export interface TestimonialSubmission {
  name: string;
  role: string;
  email: string;
  testimonial: string;
}
