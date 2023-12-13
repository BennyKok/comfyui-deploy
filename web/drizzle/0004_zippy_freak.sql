CREATE TABLE IF NOT EXISTS "comfy_deploy"."workflow_run_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comfy_deploy"."machines" DROP CONSTRAINT "machines_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comfy_deploy"."workflow_runs" DROP CONSTRAINT "workflow_runs_workflow_version_id_workflow_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "comfy_deploy"."workflow_runs" ALTER COLUMN "workflow_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comfy_deploy"."workflow_runs" ALTER COLUMN "machine_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfy_deploy"."machines" ADD CONSTRAINT "machines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "comfy_deploy"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfy_deploy"."workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_version_id_workflow_versions_id_fk" FOREIGN KEY ("workflow_version_id") REFERENCES "comfy_deploy"."workflow_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfy_deploy"."workflow_run_outputs" ADD CONSTRAINT "workflow_run_outputs_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "comfy_deploy"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
