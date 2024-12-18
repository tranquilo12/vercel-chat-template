-- Update the editPoint column to be JSONB
ALTER TABLE public."Fork"
ALTER COLUMN "editPoint" TYPE jsonb USING 
  CASE 
    WHEN "editPoint" IS NULL THEN NULL
    ELSE jsonb_build_object(
      'messageId', "editPoint"::text,
      'originalContent', '',
      'newContent', '',
      'timestamp', CURRENT_TIMESTAMP
    )
  END;

-- Add the constraint back
ALTER TABLE public."Fork"
ADD CONSTRAINT "Fork_editPoint_check"
CHECK (jsonb_typeof("editPoint") = 'object' 
  AND ("editPoint" IS NULL 
    OR jsonb_typeof("editPoint"->'messageId') = 'string' 
    AND jsonb_typeof("editPoint"->'originalContent') = 'string' 
    AND jsonb_typeof("editPoint"->'newContent') = 'string' 
    AND jsonb_typeof("editPoint"->'timestamp') = 'string'));