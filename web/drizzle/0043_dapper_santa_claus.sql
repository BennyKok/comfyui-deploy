DO $$ BEGIN
 CREATE TYPE "model_type" AS ENUM('checkpoint', 'lora', 'embedding', 'vae');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."checkpoints" ADD COLUMN "model_type" "model_type" NOT NULL;