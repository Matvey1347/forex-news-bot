# 📊 Forex News Telegram Bot (Backend System)

## Overview

Backend-driven Telegram bot that delivers **personalized economic news alerts** based on user preferences.

The system fetches external economic events, processes and filters them, and sends:
- daily summaries
- real-time reminders before events

Designed as a **scalable notification system**, not just a simple bot.

---

## Problem

Traders and users:
- get overloaded with irrelevant news
- miss important economic events
- don’t have personalized filtering
- don’t receive timely reminders

---

## Solution

A backend system that:
- syncs economic events from external sources
- filters them per user preferences
- sends structured daily reports
- notifies users before important events

---

## Core Features

### 🔹 Personalized Filtering
- currencies selection (USD, EUR, etc.)
- impact level filtering (low / medium / high)
- include / exclude keywords
- timezone support

### 🔹 Scheduled Notifications
- daily summary at user-defined time
- reminders X minutes before event
- cron-based scheduling system

### 🔹 Data Sync System
- periodic sync from external API
- idempotent updates
- sync state tracking

### 🔹 Notification Tracking
- logs of sent notifications
- prevention of duplicates
- delivery control

---

## Architecture

### Stack
- NestJS (modular architecture)
- Prisma + PostgreSQL
- Telegram Bot API
- Scheduler (cron jobs)

### Key Modules
- **Sync Service** → fetch & normalize external data  
- **Scheduler Service** → handles daily reports & reminders  
- **User Preferences** → filtering logic  
- **Notification Service** → message delivery + logging  

---

## Data Flow

1. Fetch economic events from external source  
2. Normalize & store in database  
3. Apply user filters (currency, impact, keywords)  
4. Schedule notifications  
5. Send Telegram messages  
6. Log delivery state  

---

## Example Use Case

**User sets:**
- currencies: USD, EUR  
- impact: high  
- report time: 08:00  

**System:**
- sends daily summary at 08:00  
- sends reminders 15 minutes before each relevant event  

---

## Technical Highlights

- Modular NestJS architecture  
- Idempotent sync logic  
- User-level personalization  
- Scheduled job system  
- Structured database design (events, users, preferences, logs)  

---

## Limitations

- No queue system (jobs handled via scheduler)  
- In-memory state for some interactions  
- No admin panel / REST API  
- No retry/backoff strategy  

---

## Future Improvements

- Queue system (BullMQ) for scalable jobs  
- Retry & failure handling  
- Admin dashboard / API  
- Multi-source data ingestion  
- Analytics (usage, engagement)  

---

## Positioning

This project demonstrates:
- backend system design  
- scheduled processing  
- external API integration  
- user-specific data filtering  
- notification pipelines  

---

## Tech Stack

- Node.js / TypeScript  
- NestJS  
- Prisma ORM  
- PostgreSQL  
- Telegram Bot API  

---

## How to Run

```bash
git clone <repo>
cd project

npm install

# setup env
cp .env.example .env

# run
npm run start:dev