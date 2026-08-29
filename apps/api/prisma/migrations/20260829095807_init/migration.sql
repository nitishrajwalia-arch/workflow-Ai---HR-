-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'HR', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ReraStatus" AS ENUM ('received', 'applied', 'notyet', 'na');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('pre', 'building', 'handover', 'closed');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('active', 'exited');

-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "personId" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "disabledAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT NOT NULL DEFAULT '',
    "pan" TEXT NOT NULL DEFAULT '',
    "addr" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reraStatus" "ReraStatus" NOT NULL DEFAULT 'notyet',
    "rera" TEXT NOT NULL DEFAULT '',
    "stage" "ProjectStage" NOT NULL DEFAULT 'pre',
    "addr" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "tint" TEXT NOT NULL DEFAULT '#224A85',
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Staff',
    "joined" TEXT NOT NULL,
    "joinedOn" TIMESTAMP(3),
    "dob" TEXT,
    "dobOn" TIMESTAMP(3),
    "status" "PersonStatus" NOT NULL DEFAULT 'active',
    "exitedOn" TEXT,
    "perf" INTEGER NOT NULL DEFAULT 75,
    "growth" TEXT NOT NULL DEFAULT '',
    "photo" TEXT,
    "shiftIn" TEXT NOT NULL DEFAULT '09:30',
    "shiftOut" TEXT NOT NULL DEFAULT '18:30',
    "shiftHours" DOUBLE PRECISION NOT NULL DEFAULT 9,
    "officeId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "reportsToId" TEXT,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_note" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "when" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "personId" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "vPhone" BOOLEAN NOT NULL DEFAULT false,
    "vEmail" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("personId")
);

-- CreateTable
CREATE TABLE "salary" (
    "personId" TEXT NOT NULL,
    "basic" INTEGER NOT NULL DEFAULT 0,
    "hra" INTEGER NOT NULL DEFAULT 0,
    "special" INTEGER NOT NULL DEFAULT 0,
    "pf" INTEGER NOT NULL DEFAULT 0,
    "pt" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_pkey" PRIMARY KEY ("personId")
);

-- CreateTable
CREATE TABLE "device" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "imei" TEXT NOT NULL DEFAULT '',
    "sim" TEXT NOT NULL DEFAULT '',
    "issued" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ver" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "recv" TEXT NOT NULL DEFAULT '—',
    "note" TEXT NOT NULL DEFAULT '',
    "killed" TEXT,
    "zonesKilled" BOOLEAN NOT NULL DEFAULT false,
    "circumstances" TEXT,
    "lastHeld" TEXT,
    "toldWho" TEXT,
    "firNumber" TEXT,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entry" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "at" TEXT NOT NULL,
    "who" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "prev" TEXT NOT NULL,
    "seal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'decision',
    "reason" TEXT NOT NULL,
    "opened" TEXT NOT NULL,
    "closedAt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_step" (
    "id" TEXT NOT NULL,
    "exitId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT NOT NULL,
    "byId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exit_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dept_rule" (
    "dept" TEXT NOT NULL,
    "in" TEXT NOT NULL,
    "out" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "days" TEXT NOT NULL,
    "grace" INTEGER NOT NULL DEFAULT 0,
    "setBy" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dept_rule_pkey" PRIMARY KEY ("dept")
);

-- CreateTable
CREATE TABLE "leave_policy" (
    "dept" TEXT NOT NULL,
    "casual" INTEGER NOT NULL DEFAULT 0,
    "sick" INTEGER NOT NULL DEFAULT 0,
    "earned" INTEGER NOT NULL DEFAULT 0,
    "halfDay" TEXT NOT NULL DEFAULT '',
    "lateAfter" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policy_pkey" PRIMARY KEY ("dept")
);

-- CreateTable
CREATE TABLE "doc_log" (
    "id" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "tpl" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_description" (
    "role" TEXT NOT NULL,
    "jd" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_description_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "usage_counter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "hr_log" (
    "id" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "who" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "app_user_personId_idx" ON "app_user"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_tokenHash_key" ON "refresh_token"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_userId_idx" ON "refresh_token"("userId");

-- CreateIndex
CREATE INDEX "refresh_token_expiresAt_idx" ON "refresh_token"("expiresAt");

-- CreateIndex
CREATE INDEX "project_companyId_idx" ON "project"("companyId");

-- CreateIndex
CREATE INDEX "office_projectId_idx" ON "office"("projectId");

-- CreateIndex
CREATE INDEX "person_dept_idx" ON "person"("dept");

-- CreateIndex
CREATE INDEX "person_officeId_idx" ON "person"("officeId");

-- CreateIndex
CREATE INDEX "person_employerId_idx" ON "person"("employerId");

-- CreateIndex
CREATE INDEX "person_reportsToId_idx" ON "person"("reportsToId");

-- CreateIndex
CREATE INDEX "person_status_idx" ON "person"("status");

-- CreateIndex
CREATE INDEX "person_note_personId_idx" ON "person_note"("personId");

-- CreateIndex
CREATE INDEX "device_personId_idx" ON "device"("personId");

-- CreateIndex
CREATE INDEX "card_personId_idx" ON "card"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "card_personId_ver_key" ON "card"("personId", "ver");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_seq_key" ON "ledger_entry"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_seal_key" ON "ledger_entry"("seal");

-- CreateIndex
CREATE INDEX "ledger_entry_kind_idx" ON "ledger_entry"("kind");

-- CreateIndex
CREATE INDEX "ledger_entry_subject_idx" ON "ledger_entry"("subject");

-- CreateIndex
CREATE INDEX "exit_personId_idx" ON "exit"("personId");

-- CreateIndex
CREATE INDEX "exit_stage_idx" ON "exit"("stage");

-- CreateIndex
CREATE INDEX "exit_step_exitId_idx" ON "exit_step"("exitId");

-- CreateIndex
CREATE UNIQUE INDEX "exit_step_exitId_stage_key" ON "exit_step"("exitId", "stage");

-- CreateIndex
CREATE INDEX "doc_log_personId_idx" ON "doc_log"("personId");

-- CreateIndex
CREATE INDEX "doc_log_tpl_idx" ON "doc_log"("tpl");

-- CreateIndex
CREATE INDEX "hr_log_createdAt_idx" ON "hr_log"("createdAt");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office" ADD CONSTRAINT "office_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_note" ADD CONSTRAINT "person_note_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary" ADD CONSTRAINT "salary_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device" ADD CONSTRAINT "device_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit" ADD CONSTRAINT "exit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_step" ADD CONSTRAINT "exit_step_exitId_fkey" FOREIGN KEY ("exitId") REFERENCES "exit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_step" ADD CONSTRAINT "exit_step_byId_fkey" FOREIGN KEY ("byId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_log" ADD CONSTRAINT "doc_log_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_log" ADD CONSTRAINT "doc_log_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_log" ADD CONSTRAINT "doc_log_byId_fkey" FOREIGN KEY ("byId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
