ALTER TABLE "comfyui_deploy"."workflow_runs" DROP COLUMN "run_log";
ALTER TABLE "comfyui_deploy"."workflow_runs" ADD COLUMN "run_log" jsonb;