ALTER TYPE "workflow_run_status" ADD VALUE 'started';--> statement-breakpoint
ALTER TYPE "workflow_run_status" ADD VALUE 'queued';--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."workflow_runs" ADD COLUMN "queued_at" timestamp;