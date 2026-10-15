ALTER TABLE "AidreamcapesVideoTask"
  DROP CONSTRAINT IF EXISTS "AidreamcapesVideoTask_status_check";

ALTER TABLE "AidreamcapesVideoTask"
  ADD CONSTRAINT "AidreamcapesVideoTask_status_check" CHECK (
    COALESCE("data"->>'status', '') IN ('draft', 'storyboard_ready', 'rendering', 'completed', 'failed', 'cancelled')
  );
