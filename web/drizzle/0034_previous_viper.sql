ALTER TABLE "comfyui_deploy"."user_usage" RENAME COLUMN "updated_at" TO "ended_at";--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."user_usage" ADD COLUMN "org_id" text;