-- CreateTable
CREATE TABLE "home_banners" (
    "id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "button_text" TEXT,
    "link_view" TEXT,
    "order" INTEGER NOT NULL DEFAULT 999,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_banners_pkey" PRIMARY KEY ("id")
);
