import {
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { tenants } from "./platform.js";
import { tenantMatchesSession, tenantOrUserMatchesSession } from "./rls.js";

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "disabled"]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "invited",
  "active",
  "suspended",
  "revoked",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: varchar("display_name", { length: 200 }),
  status: userStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const externalIdentities = pgTable(
  "external_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 80 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (table) => [
    unique("external_identities_provider_subject_unique").on(table.provider, table.subject),
    unique("external_identities_user_provider_unique").on(table.userId, table.provider),
    index("external_identities_user_idx").on(table.userId),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: membershipStatusEnum("status").default("invited").notNull(),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("memberships_tenant_id_id_unique").on(table.tenantId, table.id),
    unique("memberships_tenant_user_unique").on(table.tenantId, table.userId),
    index("memberships_user_idx").on(table.userId),
    index("memberships_tenant_status_idx").on(table.tenantId, table.status),
    pgPolicy("memberships_select_own_or_tenant", {
      for: "select",
      to: "public",
      using: tenantOrUserMatchesSession(table.tenantId, table.userId),
    }),
    pgPolicy("memberships_insert_tenant", {
      for: "insert",
      to: "public",
      withCheck: tenantMatchesSession(table.tenantId),
    }),
    pgPolicy("memberships_update_tenant", {
      for: "update",
      to: "public",
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
    pgPolicy("memberships_delete_tenant", {
      for: "delete",
      to: "public",
      using: tenantMatchesSession(table.tenantId),
    }),
  ],
);
