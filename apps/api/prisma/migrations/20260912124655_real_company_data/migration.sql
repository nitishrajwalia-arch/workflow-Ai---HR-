-- CreateTable
CREATE TABLE "kyc" (
    "personId" TEXT NOT NULL,
    "aadhaar" TEXT NOT NULL DEFAULT '',
    "pan" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_pkey" PRIMARY KEY ("personId")
);

-- CreateTable
CREATE TABLE "unit" (
    "id" TEXT NOT NULL,
    "tower" TEXT NOT NULL,
    "firmId" TEXT,
    "address" TEXT NOT NULL DEFAULT '',
    "phone1" TEXT NOT NULL DEFAULT '',
    "phone2" TEXT NOT NULL DEFAULT '',
    "email1" TEXT NOT NULL DEFAULT '',
    "email2" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicant" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "pan" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "applicant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unit_tower_idx" ON "unit"("tower");

-- CreateIndex
CREATE INDEX "applicant_unitId_idx" ON "applicant"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "applicant_unitId_seq_key" ON "applicant"("unitId", "seq");

-- AddForeignKey
ALTER TABLE "kyc" ADD CONSTRAINT "kyc_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit" ADD CONSTRAINT "unit_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant" ADD CONSTRAINT "applicant_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
