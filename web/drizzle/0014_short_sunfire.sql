DO $$ BEGIN
 CREATE TYPE "machine_type" AS ENUM('classic', 'runpod-serverless');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."machines" ADD COLUMN "type" "machine_type" DEFAULT 'classic' NOT NULL;