DO $$ BEGIN
 CREATE TYPE "deployment_environment" AS ENUM('staging', 'production');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comfy_deploy"."deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workflow_version_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"machine_id" uuid,
	"environment" "deployment_environment" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfy_deploy"."deployments" ADD CONSTRAINT "deployments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "comfy_deploy"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfy_deploy"."deployments" ADD CONSTRAINT "deployments_workflow_version_id_workflow_versions_id_fk" FOREIGN KEY ("workflow_version_id") REFERENCES "comfy_deploy"."workflow_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfy_deploy"."deployments" ADD CONSTRAINT "deployments_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "comfy_deploy"."workflows"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfy_deploy"."deployments" ADD CONSTRAINT "deployments_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "comfy_deploy"."machines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
