ALTER TABLE "comfyui_deploy"."deployments" DROP CONSTRAINT "deployments_workflow_id_workflows_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfyui_deploy"."deployments" ADD CONSTRAINT "deployments_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "comfyui_deploy"."workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
