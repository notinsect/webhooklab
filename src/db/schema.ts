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

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).default("Untitled Endpoint").notNull(),
    token: varchar("token", { length: 64 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("webhook_endpoints_token_idx").on(table.token),
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

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ many }) => ({
  requests: many(webhookRequests),
}));

export const webhookRequestsRelations = relations(webhookRequests, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookRequests.endpointId],
    references: [webhookEndpoints.id],
  }),
}));

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;

export type WebhookRequest = typeof webhookRequests.$inferSelect;
export type NewWebhookRequest = typeof webhookRequests.$inferInsert;
