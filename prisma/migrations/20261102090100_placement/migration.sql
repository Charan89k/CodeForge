-- CreateEnum
CREATE TYPE "PlacementDriveStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PlacementStage" AS ENUM ('APPLIED', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'ACCEPTED', 'DECLINED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "placement_records" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "batchYear" INTEGER NOT NULL,
    "cgpa" DECIMAL(4,2) NOT NULL,
    "backlogs" INTEGER NOT NULL DEFAULT 0,
    "attendancePercent" INTEGER,
    "skills" TEXT[],
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_companies" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiter_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_contacts" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruiter_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_notes" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruiter_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_drives" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "packageLpa" DECIMAL(7,2),
    "isInternship" BOOLEAN NOT NULL DEFAULT false,
    "status" "PlacementDriveStatus" NOT NULL DEFAULT 'DRAFT',
    "deadline" TIMESTAMP(3) NOT NULL,
    "minCgpa" DECIMAL(4,2),
    "maxBacklogs" INTEGER,
    "minAttendance" INTEGER,
    "departments" TEXT[],
    "batchYears" INTEGER[],
    "requiredSkills" TEXT[],
    "excludePlaced" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_drives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_applications" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" "PlacementStage" NOT NULL DEFAULT 'APPLIED',
    "eligibility" JSONB NOT NULL,
    "interviewAt" TIMESTAMP(3),
    "offerLpa" DECIMAL(7,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "placement_records_institutionId_department_idx" ON "placement_records"("institutionId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "placement_records_institutionId_userId_key" ON "placement_records"("institutionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_companies_institutionId_name_key" ON "recruiter_companies"("institutionId", "name");

-- CreateIndex
CREATE INDEX "recruiter_contacts_companyId_idx" ON "recruiter_contacts"("companyId");

-- CreateIndex
CREATE INDEX "recruiter_notes_companyId_createdAt_idx" ON "recruiter_notes"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "placement_drives_institutionId_status_deadline_idx" ON "placement_drives"("institutionId", "status", "deadline");

-- CreateIndex
CREATE INDEX "placement_applications_institutionId_stage_idx" ON "placement_applications"("institutionId", "stage");

-- CreateIndex
CREATE INDEX "placement_applications_userId_idx" ON "placement_applications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "placement_applications_driveId_userId_key" ON "placement_applications"("driveId", "userId");

-- AddForeignKey
ALTER TABLE "placement_records" ADD CONSTRAINT "placement_records_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_records" ADD CONSTRAINT "placement_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_companies" ADD CONSTRAINT "recruiter_companies_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_contacts" ADD CONSTRAINT "recruiter_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "recruiter_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_notes" ADD CONSTRAINT "recruiter_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "recruiter_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_drives" ADD CONSTRAINT "placement_drives_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "recruiter_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_applications" ADD CONSTRAINT "placement_applications_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "placement_drives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_applications" ADD CONSTRAINT "placement_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Tenant isolation, on the same pattern as the classes and exams tables.
-- ---------------------------------------------------------------------------
ALTER TABLE "placement_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recruiter_companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recruiter_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recruiter_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "placement_drives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "placement_applications" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON
  "placement_records", "recruiter_companies", "recruiter_contacts",
  "placement_drives", "placement_applications"
TO te_tenant;
-- Append-only: no UPDATE.
GRANT SELECT, INSERT ON "recruiter_notes" TO te_tenant;

-- A placement officer or institution admin, active, in the current institution.
CREATE FUNCTION te_is_placement_staff() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT te_is_platform_admin() OR EXISTS (
      SELECT 1 FROM "institution_memberships" m
      JOIN "institutions" i ON i.id = m."institutionId"
      WHERE m."institutionId" = te_institution_id()
        AND m."userId" = te_user_id()
        AND m.status = 'ACTIVE' AND i.status = 'ACTIVE'
        AND m.role IN ('PLACEMENT_OFFICER', 'INSTITUTION_ADMIN')
    )
  $$;

-- Any active member of the current institution.
CREATE FUNCTION te_is_active_member() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT te_is_platform_admin() OR EXISTS (
      SELECT 1 FROM "institution_memberships" m
      JOIN "institutions" i ON i.id = m."institutionId"
      WHERE m."institutionId" = te_institution_id()
        AND m."userId" = te_user_id()
        AND m.status = 'ACTIVE' AND i.status = 'ACTIVE'
    )
  $$;

REVOKE ALL ON FUNCTION te_is_placement_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION te_is_active_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION te_is_placement_staff() TO te_tenant;
GRANT EXECUTE ON FUNCTION te_is_active_member() TO te_tenant;

-- A student reads their own record; only the office writes.
CREATE POLICY tenant_select ON "placement_records" FOR SELECT TO te_tenant
  USING ("institutionId" = te_institution_id()
    AND ("userId" = te_user_id() OR te_is_placement_staff()));
CREATE POLICY tenant_insert ON "placement_records" FOR INSERT TO te_tenant
  WITH CHECK ("institutionId" = te_institution_id() AND te_is_placement_staff());
CREATE POLICY tenant_update ON "placement_records" FOR UPDATE TO te_tenant
  USING ("institutionId" = te_institution_id() AND te_is_placement_staff())
  WITH CHECK ("institutionId" = te_institution_id() AND te_is_placement_staff());

-- The recruiter CRM is the office's alone.
CREATE POLICY tenant_all ON "recruiter_companies" FOR ALL TO te_tenant
  USING ("institutionId" = te_institution_id() AND te_is_placement_staff())
  WITH CHECK ("institutionId" = te_institution_id() AND te_is_placement_staff());
CREATE POLICY tenant_all ON "recruiter_contacts" FOR ALL TO te_tenant
  USING ("institutionId" = te_institution_id() AND te_is_placement_staff())
  WITH CHECK ("institutionId" = te_institution_id() AND te_is_placement_staff());
CREATE POLICY tenant_all ON "recruiter_notes" FOR ALL TO te_tenant
  USING ("institutionId" = te_institution_id() AND te_is_placement_staff())
  WITH CHECK ("institutionId" = te_institution_id() AND te_is_placement_staff());

-- Members see a drive once it leaves draft; only the office writes.
CREATE POLICY tenant_select ON "placement_drives" FOR SELECT TO te_tenant
  USING ("institutionId" = te_institution_id()
    AND (te_is_placement_staff() OR (status <> 'DRAFT' AND te_is_active_member())));
CREATE POLICY tenant_insert ON "placement_drives" FOR INSERT TO te_tenant
  WITH CHECK ("institutionId" = te_institution_id() AND te_is_placement_staff());
CREATE POLICY tenant_update ON "placement_drives" FOR UPDATE TO te_tenant
  USING ("institutionId" = te_institution_id() AND te_is_placement_staff())
  WITH CHECK ("institutionId" = te_institution_id() AND te_is_placement_staff());

-- A student sees and changes only their own applications.
CREATE POLICY tenant_select ON "placement_applications" FOR SELECT TO te_tenant
  USING ("institutionId" = te_institution_id()
    AND ("userId" = te_user_id() OR te_is_placement_staff()));
CREATE POLICY tenant_insert ON "placement_applications" FOR INSERT TO te_tenant
  WITH CHECK ("institutionId" = te_institution_id() AND "userId" = te_user_id()
    AND te_is_active_member());
CREATE POLICY tenant_update ON "placement_applications" FOR UPDATE TO te_tenant
  USING ("institutionId" = te_institution_id()
    AND ("userId" = te_user_id() OR te_is_placement_staff()))
  WITH CHECK ("institutionId" = te_institution_id()
    AND ("userId" = te_user_id() OR te_is_placement_staff()));

-- One accepted offer per student per institution, whatever races.
CREATE UNIQUE INDEX "placement_applications_one_accepted"
  ON "placement_applications" ("institutionId", "userId")
  WHERE stage = 'ACCEPTED';
