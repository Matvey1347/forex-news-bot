import { Injectable } from '@nestjs/common';
import { User, UserPreference } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureUserAndPreferences(telegramUser: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<User & { preferences: UserPreference | null }> {
    const user = await this.prisma.user.upsert({
      where: { telegramId: String(telegramUser.id) },
      update: {
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        isActive: true,
      },
      create: {
        telegramId: String(telegramUser.id),
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
      },
      include: { preferences: true },
    });

    if (user.preferences) {
      return user;
    }

    const timezone = process.env.APP_TIMEZONE ?? 'Europe/Warsaw';
    const dailyReportTime = process.env.DEFAULT_DAILY_REPORT_TIME ?? '08:00';
    const reminderMinutesBefore = Number(
      process.env.DEFAULT_REMINDER_MINUTES_BEFORE ?? 15,
    );

    const preferences = await this.prisma.userPreference.create({
      data: {
        userId: user.id,
        timezone,
        dailyReportTime,
        reminderMinutesBefore,
        currencies: [],
        impacts: [],
        includeKeywords: [],
        excludeKeywords: [],
      },
    });

    return { ...user, preferences };
  }

  async findByTelegramIdWithPreferences(telegramId: string) {
    return this.prisma.user.findUnique({
      where: { telegramId },
      include: { preferences: true },
    });
  }
}
