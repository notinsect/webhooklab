CREATE TABLE "rate_limits" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) DEFAULT 'Untitled Endpoint' NOT NULL,
	"token" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_endpoints_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "webhook_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"method" varchar(10) NOT NULL,
	"path" text NOT NULL,
	"query" jsonb,
	"headers" jsonb,
	"body" jsonb,
	"raw_body" text,
	"content_type" text,
	"body_size" integer,
	"ip_address" text,
	"user_agent" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_requests" ADD CONSTRAINT "webhook_requests_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_limits_reset_at_idx" ON "rate_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_token_idx" ON "webhook_endpoints" USING btree ("token");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_user_id_idx" ON "webhook_endpoints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "webhook_requests_endpoint_id_idx" ON "webhook_requests" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "webhook_requests_endpoint_received_idx" ON "webhook_requests" USING btree ("endpoint_id","received_at");--> statement-breakpoint
CREATE INDEX "webhook_requests_endpoint_method_idx" ON "webhook_requests" USING btree ("endpoint_id","method","received_at");