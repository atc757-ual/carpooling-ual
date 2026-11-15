import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { AdminFaqTopicsService } from './admin-faq-topics.service';
import {
  AdminFaqsController,
  AdminFaqTopicsController,
} from './admin-faqs.controller';
import { AdminFaqsService } from './admin-faqs.service';
import { FaqTopic } from './entities/faq-topic.entity';
import { Faq } from './entities/faq.entity';
import { FaqsController, FaqTopicsController } from './faqs.controller';
import { FaqsService } from './faqs.service';

// Centro de ayuda: las preguntas frecuentes por tema, que la app lee (las
// publicadas) y el panel de administración gestiona
@Module({
  imports: [TypeOrmModule.forFeature([Faq, FaqTopic]), EventsModule],
  controllers: [
    FaqsController,
    FaqTopicsController,
    AdminFaqsController,
    AdminFaqTopicsController,
  ],
  providers: [FaqsService, AdminFaqsService, AdminFaqTopicsService],
})
export class HelpModule {}
