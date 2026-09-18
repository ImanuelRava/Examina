-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE INDEX "Student_email_idx" ON "Student"("email");

-- AddColumn (nullable so existing anonymous attempts are not broken)
ALTER TABLE "Attempt" ADD COLUMN "studentId" TEXT;

-- AddForeignKey (SetNull so deleting a student keeps their past attempts as anonymous)
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Attempt_studentId_idx" ON "Attempt"("studentId");

-- CreateIndex (for admin results ordering by date)
CREATE INDEX "Attempt_createdAt_idx" ON "Attempt"("createdAt");

-- CreateIndex (for reverse queries on answers by question)
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");
