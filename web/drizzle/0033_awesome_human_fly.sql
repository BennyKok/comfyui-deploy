CREATE TABLE IF NOT EXISTS "comfyui_deploy"."auth_requests" (
	"request_id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"org_id" text,
	"api_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
