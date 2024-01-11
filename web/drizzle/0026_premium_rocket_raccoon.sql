DO $$ BEGIN
 CREATE TYPE "machine_gpu" AS ENUM('T4', 'A10G', 'A100');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "comfyui_deploy"."machines" ADD COLUMN "gpu" "machine_gpu";