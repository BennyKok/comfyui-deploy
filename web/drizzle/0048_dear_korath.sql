ALTER TYPE "workflow_run_status" ADD VALUE 'timeout';--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."workflow_runs" ADD COLUMN "run_log" text;