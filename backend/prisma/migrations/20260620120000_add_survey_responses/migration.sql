CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "branch" TEXT NOT NULL,
    "rating_general" INTEGER NOT NULL,
    "rating_food" INTEGER NOT NULL,
    "rating_service" INTEGER NOT NULL,
    "rating_wait_time" INTEGER NOT NULL,
    "rating_cleanliness" INTEGER NOT NULL,
    "would_return" TEXT NOT NULL,
    "comment" TEXT,
    "ip_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "survey_responses_branch_idx" ON "survey_responses"("branch");
CREATE INDEX "survey_responses_created_at_idx" ON "survey_responses"("created_at");
CREATE INDEX "survey_responses_rating_general_idx" ON "survey_responses"("rating_general");
