ALTER TABLE "comfyui_deploy"."subscription_status" RENAME COLUMN "subscription_plan_id" TO "subscription_id";--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."subscription_status" ADD COLUMN "subscription_item_plan_id" text;--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."subscription_status" ADD COLUMN "subscription_item_api_id" text;