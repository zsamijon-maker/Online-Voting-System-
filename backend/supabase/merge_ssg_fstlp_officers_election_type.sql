-- Merge Student Government and FSTLP Officers into one election type.
-- Safe data migration: updates labels and type in-place without deleting vote/candidate data.

BEGIN;

-- 1) Rename position labels by current election type while preserving max_vote.
UPDATE election_positions ep
SET
    position_name = CASE ep.position_name
        WHEN 'President' THEN 'SSG President'
        WHEN 'Vice President' THEN 'SSG Vice President'
        WHEN 'Senators' THEN 'SSG Senators'
        ELSE ep.position_name
    END
FROM elections e
WHERE
    ep.election_id = e.id
    AND e.type = 'student_government'
    AND ep.position_name IN (
        'President',
        'Vice President',
        'Senators'
    );

UPDATE election_positions ep
SET
    position_name = CASE ep.position_name
        WHEN 'President' THEN 'FSTLP President'
        WHEN 'Vice President' THEN 'FSTLP Vice President'
        WHEN 'Secretary' THEN 'FSTLP Secretary'
        WHEN 'Treasurer' THEN 'FSTLP Treasurer'
        WHEN 'Auditor' THEN 'FSTLP Auditor'
        WHEN 'PIO' THEN 'FSTLP PIO'
        WHEN 'Board Members' THEN 'FSTLP Board Members'
        ELSE ep.position_name
    END
FROM elections e
WHERE
    ep.election_id = e.id
    AND e.type = 'fstlp_officers'
    AND ep.position_name IN (
        'President',
        'Vice President',
        'Secretary',
        'Treasurer',
        'Auditor',
        'PIO',
        'Board Members'
    );

-- 2) Keep candidate/vote position text aligned with renamed election positions.
UPDATE candidates c
SET
    position = CASE c.position
        WHEN 'President' THEN 'SSG President'
        WHEN 'Vice President' THEN 'SSG Vice President'
        WHEN 'Senators' THEN 'SSG Senators'
        ELSE c.position
    END
FROM elections e
WHERE
    c.election_id = e.id
    AND e.type = 'student_government'
    AND c.position IN (
        'President',
        'Vice President',
        'Senators'
    );

UPDATE candidates c
SET
    position = CASE c.position
        WHEN 'President' THEN 'FSTLP President'
        WHEN 'Vice President' THEN 'FSTLP Vice President'
        WHEN 'Secretary' THEN 'FSTLP Secretary'
        WHEN 'Treasurer' THEN 'FSTLP Treasurer'
        WHEN 'Auditor' THEN 'FSTLP Auditor'
        WHEN 'PIO' THEN 'FSTLP PIO'
        WHEN 'Board Members' THEN 'FSTLP Board Members'
        ELSE c.position
    END
FROM elections e
WHERE
    c.election_id = e.id
    AND e.type = 'fstlp_officers'
    AND c.position IN (
        'President',
        'Vice President',
        'Secretary',
        'Treasurer',
        'Auditor',
        'PIO',
        'Board Members'
    );

UPDATE votes v
SET
    position = CASE v.position
        WHEN 'President' THEN 'SSG President'
        WHEN 'Vice President' THEN 'SSG Vice President'
        WHEN 'Senators' THEN 'SSG Senators'
        ELSE v.position
    END
FROM elections e
WHERE
    v.election_id = e.id
    AND e.type = 'student_government'
    AND v.position IN (
        'President',
        'Vice President',
        'Senators'
    );

UPDATE votes v
SET
    position = CASE v.position
        WHEN 'President' THEN 'FSTLP President'
        WHEN 'Vice President' THEN 'FSTLP Vice President'
        WHEN 'Secretary' THEN 'FSTLP Secretary'
        WHEN 'Treasurer' THEN 'FSTLP Treasurer'
        WHEN 'Auditor' THEN 'FSTLP Auditor'
        WHEN 'PIO' THEN 'FSTLP PIO'
        WHEN 'Board Members' THEN 'FSTLP Board Members'
        ELSE v.position
    END
FROM elections e
WHERE
    v.election_id = e.id
    AND e.type = 'fstlp_officers'
    AND v.position IN (
        'President',
        'Vice President',
        'Secretary',
        'Treasurer',
        'Auditor',
        'PIO',
        'Board Members'
    );

-- 3) Merge election type values in-place (no new election rows are created).
UPDATE elections
SET
    type = 'ssg_fstlp_officers'
WHERE
    type IN (
        'student_government',
        'fstlp_officers'
    );

-- 4) Enforce the new election type domain.
ALTER TABLE elections
DROP CONSTRAINT IF EXISTS elections_type_check;

ALTER TABLE elections
ADD CONSTRAINT elections_type_check CHECK (
    type IN (
        'ssg_fstlp_officers',
        'class_representative',
        'club_officers',
        'other'
    )
);

COMMIT;