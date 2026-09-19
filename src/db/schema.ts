import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("users_email_idx").on(table.email)]
);

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).default("Untitled Endpoint").notNull(),
    token: varchar("token", { length: 64 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("webhook_endpoints_token_idx").on(table.token),
    index("webhook_endpoints_user_id_idx").on(table.userId),
  ]
);

export const webhookRequests = pgTable(
  "webhook_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    method: varchar("method", { length: 10 }).notNull(),
    path: text("path").notNull(),
    query: jsonb("query").$type<Record<string, unknown>>(),
    headers: jsonb("headers").$type<Record<string, string>>(),
    body: jsonb("body").$type<unknown>(),
    rawBody: text("raw_body"),
    contentType: text("content_type"),
    bodySize: integer("body_size"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("webhook_requests_endpoint_id_idx").on(table.endpointId),
    index("webhook_requests_endpoint_received_idx").on(table.endpointId, table.receivedAt),
    index("webhook_requests_endpoint_method_idx").on(table.endpointId, table.method, table.receivedAt),
  ]
);

export const webhookReplays = pgTable(
  "webhook_replays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => webhookRequests.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    destinationUrl: text("destination_url").notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    status: integer("status"),
    statusText: text("status_text"),
    durationMs: integer("duration_ms"),
    responseHeaders: jsonb("response_headers").$type<Record<string, string>>(),
    responseBody: text("response_body"),
    responseSize: integer("response_size"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("webhook_replays_request_id_idx").on(table.requestId),
    index("webhook_replays_user_id_idx").on(table.userId),
  ]
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: varchar("key", { length: 255 }).primaryKey(),
    count: integer("count").notNull().default(0),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("rate_limits_reset_at_idx").on(table.resetAt)]
);

export const usersRelations = relations(users, ({ many }) => ({
  endpoints: many(webhookEndpoints),
  replays: many(webhookReplays),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  user: one(users, {
    fields: [webhookEndpoints.userId],
    references: [users.id],
  }),
  requests: many(webhookRequests),
}));

export const webhookRequestsRelations = relations(webhookRequests, ({ one, many }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookRequests.endpointId],
    references: [webhookEndpoints.id],
  }),
  replays: many(webhookReplays),
}));

export const webhookReplaysRelations = relations(webhookReplays, ({ one }) => ({
  request: one(webhookRequests, {
    fields: [webhookReplays.requestId],
    references: [webhookRequests.id],
  }),
  user: one(users, {
    fields: [webhookReplays.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;

export type WebhookRequest = typeof webhookRequests.$inferSelect;
export type NewWebhookRequest = typeof webhookRequests.$inferInsert;

export type WebhookReplay = typeof webhookReplays.$inferSelect;
export type NewWebhookReplay = typeof webhookReplays.$inferInsert;

export type RateLimit = typeof rateLimits.$inferSelect;
