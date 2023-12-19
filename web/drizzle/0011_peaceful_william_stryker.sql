DO $$ BEGIN
 CREATE TYPE "workflow_run_origin" AS ENUM('manual', 'api');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."workflow_runs" ADD COLUMN "origin" "workflow_run_origin" DEFAULT 'api' NOT NULL;