DO $$ BEGIN
 CREATE TYPE "machine_status" AS ENUM('ready', 'building', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."machines" ADD COLUMN "status" "machine_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."machines" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."machines" ADD COLUMN "build_log" text;