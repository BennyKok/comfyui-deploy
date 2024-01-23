DO $$ BEGIN
 CREATE TYPE "model_upload_type" AS ENUM('civitai', 'huggingface', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "resource_upload" AS ENUM('started', 'failed', 'succeded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comfyui_deploy"."checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"org_id" text,
	"description" text,
	"checkpoint_volume_id" uuid NOT NULL,
	"model_name" text,
	"civitai_id" text,
	"civitai_version_id" text,
	"civitai_url" text,
	"civitai_download_url" text,
	"civitai_model_response" jsonb,
	"hf_url" text,
	"s3_url" text,
	"client_url" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"status" "resource_upload" DEFAULT 'started' NOT NULL,
	"upload_machine_id" text,
	"upload_type" "model_upload_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comfyui_deploy"."checkpointVolumeTable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"org_id" text,
	"volume_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfyui_deploy"."checkpoints" ADD CONSTRAINT "checkpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "comfyui_deploy"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfyui_deploy"."checkpoints" ADD CONSTRAINT "checkpoints_checkpoint_volume_id_workflow_runs_id_fk" FOREIGN KEY ("checkpoint_volume_id") REFERENCES "comfyui_deploy"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfyui_deploy"."checkpointVolumeTable" ADD CONSTRAINT "checkpointVolumeTable_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "comfyui_deploy"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
