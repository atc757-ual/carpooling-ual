import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaqTopic } from './entities/faq-topic.entity';
import { Faq } from './entities/faq.entity';
import { FaqsController, FaqTopicsController } from './faqs.controller';
import { FaqsService } from './faqs.service';

// Centro de ayuda: las preguntas frecuentes por tema, que la app lee (las
// publicadas) y el panel de administración gestiona
@Module({
  imports: [TypeOrmModule.forFeature([Faq, FaqTopic])],
  controllers: [FaqsController, FaqTopicsController],
  providers: [FaqsService],
})
export class HelpModule {}
