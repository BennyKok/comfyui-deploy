DO $$ BEGIN
 CREATE TYPE "model_type" AS ENUM('checkpoint', 'lora', 'embedding', 'vae');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."checkpoints" RENAME TO "models";--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."checkpoint_volume" RENAME TO "user_volume";--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."models" RENAME COLUMN "checkpoint_volume_id" TO "user_volume_id";--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."models" DROP CONSTRAINT "checkpoints_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."models" DROP CONSTRAINT "checkpoints_checkpoint_volume_id_checkpoint_volume_id_fk";
--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."user_volume" DROP CONSTRAINT "checkpoint_volume_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."models" ADD COLUMN "model_type" "model_type" DEFAULT 'checkpoint' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfyui_deploy"."models" ADD CONSTRAINT "models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "comfyui_deploy"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfyui_deploy"."models" ADD CONSTRAINT "models_user_volume_id_user_volume_id_fk" FOREIGN KEY ("user_volume_id") REFERENCES "comfyui_deploy"."user_volume"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfyui_deploy"."user_volume" ADD CONSTRAINT "user_volume_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "comfyui_deploy"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
