DO $$ BEGIN
 CREATE TYPE "subscription_plan" AS ENUM('basic', 'pro', 'enterprise');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "subscription_plan_status" AS ENUM('active', 'deleted', 'paused');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comfyui_deploy"."subscription_status" (
	"stripe_customer_id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"org_id" text,
	"plan" "subscription_plan" NOT NULL,
	"status" "subscription_plan_status" NOT NULL,
	"subscription_plan_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
