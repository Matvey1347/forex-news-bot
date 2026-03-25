import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramUpdate } from './telegram.update';
import { UserService } from './services/user.service';
import { NotificationService } from './services/notification.service';
import { EventFilterService } from './services/event-filter.service';
import { EconomicCalendarSyncService } from './services/economic-calendar-sync.service';
import { TelegramSchedulerService } from './services/telegram-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    TelegramUpdate,
    UserService,
    NotificationService,
    EventFilterService,
    EconomicCalendarSyncService,
    TelegramSchedulerService,
  ],
})
export class TelegramModule {}
