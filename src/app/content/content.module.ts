import { Module } from '@nestjs/common';
import { ExperiencesModule } from './experiences/experiences.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { TestimonialsModule } from './testimonials/testimonials.module.js';
import { HighlightsModule } from './highlights/highlights.module.js';
import { SocialLinksModule } from './social-links/social-links.module.js';
import { TechnologiesModule } from './technologies/technologies.module.js';
import { ContactInfoModule } from './contact-info/contact-info.module.js';
import { CertificationsModule } from './certifications/certifications.module.js';

// One sub-module per collection, each served under /content/<collection>.
@Module({
  imports: [
    ExperiencesModule,
    ProjectsModule,
    TestimonialsModule,
    HighlightsModule,
    SocialLinksModule,
    TechnologiesModule,
    ContactInfoModule,
    CertificationsModule,
  ],
})
export class ContentModule {}
