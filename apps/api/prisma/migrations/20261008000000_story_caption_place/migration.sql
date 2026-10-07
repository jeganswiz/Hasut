-- Where a caption sits on the 9:16 frame, as integer percentages.
-- Null keeps the older bottom overlay for stories published before placement.
ALTER TABLE "stories" ADD COLUMN "caption_x" INTEGER,
ADD COLUMN "caption_y" INTEGER,
ADD COLUMN "caption_w" INTEGER;
