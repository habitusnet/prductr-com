CREATE TABLE "agent_instances" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'idle',
	"current_task_id" varchar(255),
	"last_heartbeat" timestamp NOT NULL,
	"metadata" text DEFAULT '{}',
	"started_at" timestamp DEFAULT now(),
	CONSTRAINT "agent_instances_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(255) NOT NULL,
	"capabilities" text DEFAULT '[]',
	"cost_per_token_input" numeric(10, 8) DEFAULT '0',
	"cost_per_token_output" numeric(10, 8) DEFAULT '0',
	"quota_limit" bigint,
	"quota_used" bigint DEFAULT 0,
	"quota_reset_at" timestamp,
	"status" varchar(50) DEFAULT 'idle',
	"last_heartbeat" timestamp,
	"metadata" text DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "connector_configs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"config" text DEFAULT '{}',
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"task_id" varchar(255),
	"model" varchar(255) NOT NULL,
	"tokens_input" bigint NOT NULL,
	"tokens_output" bigint NOT NULL,
	"cost" numeric(10, 6) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"priority" varchar(50) DEFAULT 'normal' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"context" text DEFAULT '{}',
	"assigned_to" varchar(255),
	"resolved_by" varchar(255),
	"resolution" text,
	"snoozed_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "file_conflicts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"agents" text DEFAULT '[]',
	"strategy" varchar(50) NOT NULL,
	"resolution" varchar(50),
	"resolved_by" varchar(255),
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_locks" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"task_id" varchar(255),
	"locked_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'member',
	"invited_at" timestamp DEFAULT now(),
	"joined_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'free',
	"billing_email" varchar(255),
	"api_keys" text DEFAULT '[]',
	"settings" text DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project_agents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'contributor',
	"custom_instructions" text,
	"instructions_file" text,
	"allowed_paths" text DEFAULT '[]',
	"denied_paths" text DEFAULT '[]',
	"token_budget" bigint,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"root_path" text,
	"git_remote" text,
	"git_branch" varchar(255) DEFAULT 'main',
	"conflict_strategy" varchar(50) DEFAULT 'lock',
	"budget_total" numeric(10, 2),
	"budget_spent" numeric(10, 2) DEFAULT '0',
	"budget_alert_threshold" integer DEFAULT 80,
	"settings" text DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_activities" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"task_id" varchar(255) NOT NULL,
	"agent_id" varchar(255),
	"action" varchar(50) NOT NULL,
	"description" text,
	"metadata" text DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"parent_id" varchar(255),
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'pending',
	"priority" varchar(50) DEFAULT 'medium',
	"assigned_to" varchar(255),
	"claimed_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"due_at" timestamp,
	"dependencies" text DEFAULT '[]',
	"blocked_by" varchar(255),
	"estimated_tokens" bigint,
	"actual_tokens" bigint,
	"files" text DEFAULT '[]',
	"tags" text DEFAULT '[]',
	"result" text,
	"error_message" text,
	"metadata" text DEFAULT '{}',
	"created_by" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_secrets" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"encrypted_value" text NOT NULL,
	"iv" varchar(255) NOT NULL,
	"auth_tag" varchar(255) NOT NULL,
	"provider" varchar(255),
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"password_hash" text,
	"auth_provider" varchar(50) DEFAULT 'local',
	"auth_provider_id" varchar(255),
	"avatar_url" text,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agent_instances" ADD CONSTRAINT "agent_instances_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_instances" ADD CONSTRAINT "agent_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_instances" ADD CONSTRAINT "agent_instances_current_task_id_tasks_id_fk" FOREIGN KEY ("current_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_configs" ADD CONSTRAINT "connector_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_conflicts" ADD CONSTRAINT "file_conflicts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_locks" ADD CONSTRAINT "file_locks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_locks" ADD CONSTRAINT "file_locks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_agents" ADD CONSTRAINT "project_agents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_agents" ADD CONSTRAINT "project_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_agents_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_secrets" ADD CONSTRAINT "user_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;