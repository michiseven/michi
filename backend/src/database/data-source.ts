import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import {
  ExternalDataSnapshot,
  JapaneseMarketMetric,
  Place,
  Receipt,
  ReceiptItem,
  RecommendationResult,
  RecommendationScore,
  Trip,
  TripPreference,
  TripStop,
  UserEvent,
  Visit,
} from './entities';
import { InitialMichiSchema1723996800000 } from './migrations/1723996800000-initial-michi-schema';
import { AddReceiptFoundation1723996801000 } from './migrations/1723996801000-add-receipt-foundation';

config({ path: ['.env', '../.env'], quiet: true });

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://michi:michi@localhost:55432/michi',
  entities: [
    Trip,
    TripPreference,
    Place,
    TripStop,
    RecommendationResult,
    RecommendationScore,
    ExternalDataSnapshot,
    JapaneseMarketMetric,
    UserEvent,
    Receipt,
    ReceiptItem,
    Visit,
  ],
  migrations: [InitialMichiSchema1723996800000, AddReceiptFoundation1723996801000],
  synchronize: false,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export default dataSource;
