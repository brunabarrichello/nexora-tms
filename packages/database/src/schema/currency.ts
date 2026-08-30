import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  smallint,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const currencies = pgTable(
  'currencies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 3 }).notNull(),
    numericCode: varchar('numeric_code', { length: 3 }),
    name: varchar('name', { length: 120 }).notNull(),
    symbol: varchar('symbol', { length: 8 }),
    minorUnit: smallint('minor_unit').default(2).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('currencies_code_unique').on(table.code),
    unique('currencies_numeric_code_unique').on(table.numericCode),
    check('currencies_code_check', sql`${table.code} ~ '^[A-Z]{3}$'`),
    check(
      'currencies_numeric_code_check',
      sql`${table.numericCode} IS NULL OR ${table.numericCode} ~ '^[0-9]{3}$'`,
    ),
    check('currencies_name_check', sql`length(trim(${table.name})) >= 2`),
    check('currencies_minor_unit_check', sql`${table.minorUnit} >= 0 AND ${table.minorUnit} <= 6`),
    index('currencies_active_name_idx').on(table.isActive, table.name),
  ],
);
