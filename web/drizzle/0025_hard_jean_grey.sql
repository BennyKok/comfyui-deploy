ALTER TABLE "comfyui_deploy"."workflow_runs" DROP CONSTRAINT "workflow_runs_machine_id_machines_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfyui_deploy"."workflow_runs" ADD CONSTRAINT "workflow_runs_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "comfyui_deploy"."machines"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
