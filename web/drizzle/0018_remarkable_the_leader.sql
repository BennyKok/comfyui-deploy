ALTER TABLE "comfyui_deploy"."workflow_runs" DROP CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfyui_deploy"."workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "comfyui_deploy"."workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
