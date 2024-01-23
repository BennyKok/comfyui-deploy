ALTER TYPE "resource_upload" ADD VALUE 'error';--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."checkpoints" ADD COLUMN "build_log" text;