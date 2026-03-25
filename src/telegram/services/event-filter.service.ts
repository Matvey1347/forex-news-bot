import { Injectable } from '@nestjs/common';
import { EconomicEvent, UserPreference } from '@prisma/client';

@Injectable()
export class EventFilterService {
  filterEvents(events: EconomicEvent[], preferences: UserPreference): EconomicEvent[] {
    return events.filter((event) => this.matches(event, preferences));
  }

  matches(event: EconomicEvent, preferences: UserPreference): boolean {
    const country = event.country.toLowerCase();
    const impact = event.impact.toLowerCase();
    const title = event.title.toLowerCase();

    const currencies = preferences.currencies.map((item) => item.toLowerCase());
    if (currencies.length > 0 && !currencies.includes(country)) {
      return false;
    }

    const impacts = preferences.impacts.map((item) => item.toLowerCase());
    if (impacts.length > 0 && !impacts.includes(impact)) {
      return false;
    }

    const includeKeywords = preferences.includeKeywords.map((item) => item.toLowerCase());
    if (
      includeKeywords.length > 0 &&
      !includeKeywords.some((keyword) => title.includes(keyword))
    ) {
      return false;
    }

    const excludeKeywords = preferences.excludeKeywords.map((item) => item.toLowerCase());
    if (excludeKeywords.some((keyword) => title.includes(keyword))) {
      return false;
    }

    return true;
  }
}
