-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'healthy',

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);