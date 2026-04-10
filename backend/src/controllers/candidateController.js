import { supabase } from '../lib/supabaseClient.js';
import { uploadEntityImage, deleteEntityImageByPublicUrl } from '../lib/storageUpload.js';

const isUndefinedColumnError = (error) => error?.code === '42703';

const persistCandidateUploadedPhoto = async (candidateId, publicUrl) => {
  const withPhotoPath = await supabase
    .from('candidates')
    .update({ photo_path: publicUrl, photo_url: publicUrl })
    .eq('id', candidateId)
    .select('*, election_positions(id, position_name, max_vote)')
    .single();

  if (!withPhotoPath.error) return withPhotoPath;

  // Backward-compat fallback when photo_path column is not present yet.
  if (!isUndefinedColumnError(withPhotoPath.error)) return withPhotoPath;

  return supabase
    .from('candidates')
    .update({ photo_url: publicUrl })
    .eq('id', candidateId)
    .select('*, election_positions(id, position_name, max_vote)')
    .single();
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
};

const normalizeCandidate = (row) => {
  if (!row) return row;
  const resolvedPosition = row.position || row.election_positions?.position_name || null;
  return {
    ...row,
    position: resolvedPosition,
  };
};

const getValidatedPosition = async ({ electionId, positionId }) => {
  const { data, error } = await supabase
    .from('election_positions')
    .select('id, election_id, position_name, max_vote')
    .eq('id', positionId)
    .single();

  if (error || !data) return { valid: false, reason: 'Invalid positionId.' };
  if (data.election_id !== electionId) {
    return { valid: false, reason: 'positionId does not belong to the selected election.' };
  }

  return { valid: true, position: data };
};

// GET /api/elections/:electionId/candidates
export const getCandidates = async (req, res) => {
  const { data, error } = await supabase
    .from('candidates')
    .select('*, election_positions(id, position_name, max_vote)')
    .eq('election_id', req.params.electionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  res.json((data ?? []).map(normalizeCandidate));
};

// GET /api/elections/:electionId/candidates/:id
export const getCandidateById = async (req, res) => {
  const { data, error } = await supabase
    .from('candidates')
    .select('*, election_positions(id, position_name, max_vote)')
    .eq('id', req.params.id)
    .eq('election_id', req.params.electionId)
    .single();
  if (error) return res.status(404).json({ error: 'Candidate not found.' });
  res.json(normalizeCandidate(data));
};

// POST /api/elections/:electionId/candidates
export const createCandidate = async (req, res) => {
  const { positionId, displayName, bio, platform, photoUrl, isWriteIn } = req.body;
  if (!positionId || !displayName) {
    return res.status(400).json({ error: 'positionId and displayName are required.' });
  }

  const validated = await getValidatedPosition({ electionId: req.params.electionId, positionId });
  if (!validated.valid) {
    return res.status(400).json({ error: validated.reason });
  }

  const { data, error } = await supabase
    .from('candidates')
    .insert({
      election_id: req.params.electionId,
      position_id: validated.position.id,
      position: validated.position.position_name,
      display_name: displayName,
      bio: bio || null,
      platform: platform || null,
      photo_url: photoUrl || null,
      is_write_in: parseBoolean(isWriteIn, false),
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  if (req.file) {
    let uploadedPublicUrl = null;
    try {
      const uploaded = await uploadEntityImage({
        folder: 'candidates',
        recordId: data.id,
        fileBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });
      uploadedPublicUrl = uploaded.publicUrl;

      const { data: withImage, error: updateError } = await persistCandidateUploadedPhoto(data.id, uploaded.publicUrl);
      if (updateError) throw updateError;
      return res.status(201).json(normalizeCandidate(withImage));
    } catch (imageError) {
      if (uploadedPublicUrl) {
        try {
          await deleteEntityImageByPublicUrl(uploadedPublicUrl);
        } catch {
          // Best-effort cleanup only.
        }
      }

      try {
        await supabase.from('candidates').delete().eq('id', data.id);
      } catch {
        // Best-effort rollback only.
      }

      return res.status(500).json({ error: 'Failed to upload candidate image. Please try again.' });
    }
  }

  res.status(201).json(normalizeCandidate(data));
};

// PATCH /api/elections/:electionId/candidates/:id
export const updateCandidate = async (req, res) => {
  const { positionId, displayName, bio, platform, photoUrl, isWriteIn, isActive } = req.body;
  const updates = {};

  if (positionId !== undefined) {
    const { data: existingCandidate, error: existingCandidateError } = await supabase
      .from('candidates')
      .select('election_id')
      .eq('id', req.params.id)
      .single();

    if (existingCandidateError || !existingCandidate) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }

    const validated = await getValidatedPosition({ electionId: existingCandidate.election_id, positionId });
    if (!validated.valid) {
      return res.status(400).json({ error: validated.reason });
    }

    updates.position_id = validated.position.id;
    updates.position = validated.position.position_name;
  }

  if (displayName !== undefined) updates.display_name = displayName;
  if (bio !== undefined) updates.bio = bio;
  if (platform !== undefined) updates.platform = platform;
  if (photoUrl !== undefined) updates.photo_url = photoUrl;
  if (isWriteIn !== undefined) updates.is_write_in = parseBoolean(isWriteIn, false);
  if (isActive !== undefined) updates.is_active = parseBoolean(isActive, true);

  if (req.file) {
    const { data: existing, error: existingError } = await supabase
      .from('candidates')
      .select('photo_path')
      .eq('id', req.params.id)
      .single();

    if (existingError) throw existingError;

    const uploaded = await uploadEntityImage({
      folder: 'candidates',
      recordId: req.params.id,
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    updates.photo_path = uploaded.publicUrl;
    updates.photo_url = uploaded.publicUrl;

    if (existing?.photo_path && existing.photo_path !== uploaded.publicUrl) {
      await deleteEntityImageByPublicUrl(existing.photo_path);
    }
  }

  let { data, error } = await supabase
    .from('candidates')
    .update(updates)
    .eq('id', req.params.id)
    .select('*, election_positions(id, position_name, max_vote)')
    .single();

  if (error && isUndefinedColumnError(error) && Object.prototype.hasOwnProperty.call(updates, 'photo_path')) {
    const fallbackUpdates = { ...updates };
    delete fallbackUpdates.photo_path;

    const retry = await supabase
      .from('candidates')
      .update(fallbackUpdates)
      .eq('id', req.params.id)
      .select('*, election_positions(id, position_name, max_vote)')
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  res.json(normalizeCandidate(data));
};

// DELETE /api/elections/:electionId/candidates/:id
export const deleteCandidate = async (req, res) => {
  const { error } = await supabase.from('candidates').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ message: 'Candidate deleted.' });
};
