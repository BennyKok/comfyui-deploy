ALTER TABLE "comfy_deploy"."machines" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comfy_deploy"."machines" ADD CONSTRAINT "machines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "comfy_deploy"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
