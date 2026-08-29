-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('unverified', 'pending', 'verified');

-- DropIndex
DROP INDEX "ledger_entry_prev_key";

-- CreateTable
CREATE TABLE "firm" (
    "id" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "gstin" TEXT NOT NULL DEFAULT '',
    "rera" TEXT NOT NULL DEFAULT '',
    "stage" TEXT NOT NULL DEFAULT 'building',
    "addr" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cat" TEXT NOT NULL DEFAULT '',
    "terms" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "gst" TEXT NOT NULL DEFAULT '',
    "pan" TEXT NOT NULL DEFAULT '',
    "status" "VendorStatus" NOT NULL DEFAULT 'unverified',
    "vcode" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "credit" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "id" TEXT NOT NULL,
    "vendorCode" TEXT,
    "vendorName" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "amt" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Approved',
    "firmId" TEXT,
    "del" JSONB,
    "raisedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request" (
    "id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "qty" TEXT NOT NULL,
    "when" TEXT NOT NULL DEFAULT '',
    "proj" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisition" (
    "id" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "qty" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item" (
    "item" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loc" TEXT NOT NULL DEFAULT '',
    "proj" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("item")
);

-- CreateTable
CREATE TABLE "hold" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "days" INTEGER NOT NULL DEFAULT 0,
    "by" TEXT NOT NULL,
    "why" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_move" (
    "id" TEXT NOT NULL,
    "dir" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "ref" TEXT NOT NULL DEFAULT '',
    "bill" TEXT NOT NULL DEFAULT '',
    "who" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_move_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_cap" (
    "id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "proj" TEXT NOT NULL,
    "max" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "why" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_cap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_pass" (
    "id" TEXT NOT NULL,
    "poId" TEXT,
    "vendor" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'expected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gate_pass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_event" (
    "id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "plate" TEXT NOT NULL DEFAULT '',
    "guard" TEXT NOT NULL DEFAULT '',
    "guardId" TEXT NOT NULL DEFAULT '',
    "post" TEXT NOT NULL DEFAULT '',
    "who" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submittal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromDept" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submittal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submittal_version" (
    "id" TEXT NOT NULL,
    "submittalId" TEXT NOT NULL,
    "v" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submittal_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invoice" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL DEFAULT '',
    "vendor" TEXT NOT NULL,
    "subj" TEXT NOT NULL DEFAULT '',
    "amt" INTEGER NOT NULL DEFAULT 0,
    "po" TEXT NOT NULL DEFAULT '',
    "gstin" BOOLEAN NOT NULL DEFAULT false,
    "age" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'toclear',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "amt" INTEGER NOT NULL,
    "party" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "src" TEXT NOT NULL DEFAULT '',
    "how" TEXT NOT NULL DEFAULT '',
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale" (
    "id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "tower" TEXT NOT NULL DEFAULT '',
    "proj" TEXT NOT NULL DEFAULT '',
    "firm" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "booked" TEXT NOT NULL DEFAULT '',
    "buyer" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "received" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reminder" (
    "id" TEXT NOT NULL,
    "saleId" TEXT,
    "buyer" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_account" (
    "id" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "acc" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "firm" TEXT NOT NULL DEFAULT '',
    "till" TEXT NOT NULL DEFAULT '',
    "gaps" JSONB NOT NULL DEFAULT '[]',
    "bal" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card" (
    "id" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "last" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "limit" INTEGER NOT NULL DEFAULT 0,
    "used" INTEGER NOT NULL DEFAULT 0,
    "cycle" TEXT NOT NULL DEFAULT '',
    "due" TEXT NOT NULL DEFAULT '',
    "firm" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT NOT NULL DEFAULT '',
    "pan" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_item" (
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "rate" INTEGER NOT NULL DEFAULT 0,
    "vendor" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_item_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "site_report" (
    "id" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "proj" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'low',
    "media" JSONB NOT NULL DEFAULT '[]',
    "state" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'task',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "audience" JSONB NOT NULL DEFAULT '{"type":"all"}',
    "by" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incentive_package" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "dept" TEXT NOT NULL DEFAULT '',
    "period" TEXT NOT NULL DEFAULT '',
    "how" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "issuedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incentive_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_day" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "inAt" TEXT,
    "outAt" TEXT,
    "source" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_task" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "who" TEXT NOT NULL DEFAULT '',
    "due" TEXT NOT NULL DEFAULT '',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "by" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection" (
    "key" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "connectedBy" TEXT,
    "connectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "export_record" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL DEFAULT '',
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_grant" (
    "id" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "power" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_grant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_status_idx" ON "vendor"("status");

-- CreateIndex
CREATE INDEX "vendor_cat_idx" ON "vendor"("cat");

-- CreateIndex
CREATE INDEX "purchase_order_status_idx" ON "purchase_order"("status");

-- CreateIndex
CREATE INDEX "purchase_order_vendorCode_idx" ON "purchase_order"("vendorCode");

-- CreateIndex
CREATE INDEX "purchase_request_state_idx" ON "purchase_request"("state");

-- CreateIndex
CREATE INDEX "requisition_state_idx" ON "requisition"("state");

-- CreateIndex
CREATE INDEX "hold_itemName_idx" ON "hold"("itemName");

-- CreateIndex
CREATE INDEX "stock_move_item_idx" ON "stock_move"("item");

-- CreateIndex
CREATE INDEX "stock_move_createdAt_idx" ON "stock_move"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "storage_cap_item_proj_key" ON "storage_cap"("item", "proj");

-- CreateIndex
CREATE INDEX "gate_pass_status_idx" ON "gate_pass"("status");

-- CreateIndex
CREATE INDEX "gate_event_outcome_idx" ON "gate_event"("outcome");

-- CreateIndex
CREATE INDEX "gate_event_at_idx" ON "gate_event"("at");

-- CreateIndex
CREATE INDEX "submittal_status_idx" ON "submittal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "submittal_version_submittalId_v_key" ON "submittal_version"("submittalId", "v");

-- CreateIndex
CREATE INDEX "vendor_invoice_state_idx" ON "vendor_invoice"("state");

-- CreateIndex
CREATE INDEX "expense_cat_idx" ON "expense"("cat");

-- CreateIndex
CREATE INDEX "expense_dept_idx" ON "expense"("dept");

-- CreateIndex
CREATE INDEX "sale_proj_idx" ON "sale"("proj");

-- CreateIndex
CREATE INDEX "payment_reminder_approved_idx" ON "payment_reminder"("approved");

-- CreateIndex
CREATE INDEX "site_report_cat_idx" ON "site_report"("cat");

-- CreateIndex
CREATE INDEX "site_report_state_idx" ON "site_report"("state");

-- CreateIndex
CREATE INDEX "calendar_event_date_idx" ON "calendar_event"("date");

-- CreateIndex
CREATE INDEX "incentive_package_status_idx" ON "incentive_package"("status");

-- CreateIndex
CREATE INDEX "attendance_day_personId_idx" ON "attendance_day"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_day_personId_date_key" ON "attendance_day"("personId", "date");

-- CreateIndex
CREATE INDEX "export_record_key_idx" ON "export_record"("key");

-- CreateIndex
CREATE UNIQUE INDEX "draft_userId_type_key" ON "draft"("userId", "type");

-- CreateIndex
CREATE INDEX "access_grant_userKey_idx" ON "access_grant"("userKey");

-- CreateIndex
CREATE UNIQUE INDEX "access_grant_userKey_area_power_key" ON "access_grant"("userKey", "area", "power");

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_vendorCode_fkey" FOREIGN KEY ("vendorCode") REFERENCES "vendor"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold" ADD CONSTRAINT "hold_itemName_fkey" FOREIGN KEY ("itemName") REFERENCES "inventory_item"("item") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass" ADD CONSTRAINT "gate_pass_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submittal_version" ADD CONSTRAINT "submittal_version_submittalId_fkey" FOREIGN KEY ("submittalId") REFERENCES "submittal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminder" ADD CONSTRAINT "payment_reminder_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
