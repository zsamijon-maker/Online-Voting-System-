import { supabase } from '../lib/supabaseClient.js';
import { uploadEntityImage, deleteEntityImageByPublicUrl } from '../lib/storageUpload.js';
import { logger } from '../lib/logger.js';

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const normalizeGender = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'male') return 'Male';
  if (normalized === 'female') return 'Female';

  return undefined;
};

const isRankingByGender = (scoringMethod) => scoringMethod === 'ranking_by_gender';

const buildContestantNumberConflictMessage = (scoringMethod) => {
  if (isRankingByGender(scoringMethod)) {
    return 'Contestant number is already used for this gender in this pageant.';
  }

  return 'Contestant number is already used in this pageant.';
};

const hasContestantNumberConflict = async ({
  pageantId,
  contestantNumber,
  gender,
  scoringMethod,
  excludeContestantId,
}) => {
  let query = supabase
    .from('contestants')
    .select('id', { head: true, count: 'exact' })
    .eq('pageant_id', pageantId)
    .eq('contestant_number', contestantNumber);

  if (excludeContestantId) {
    query = query.neq('id', excludeContestantId);
  }

  if (isRankingByGender(scoringMethod)) {
    query = query.eq('gender', gender);
  }

  const { count, error } = await query;
  if (error) throw error;

  return (count ?? 0) > 0;
};

const isUndefinedColumnError = (error) => error?.code === '42703';

const persistContestantUploadedPhoto = async (contestantId, publicUrl) => {
  const withPhotoPath = await supabase
    .from('contestants')
    .update({ photo_path: publicUrl, photo_url: publicUrl })
    .eq('id', contestantId)
    .select()
    .single();

  if (!withPhotoPath.error) return withPhotoPath;

  // Backward-compat fallback when photo_path column is not present yet.
  if (!isUndefinedColumnError(withPhotoPath.error)) return withPhotoPath;

  return supabase
    .from('contestants')
    .update({ photo_url: publicUrl })
    .eq('id', contestantId)
    .select()
    .single();
};

// GET /api/pageants/:pageantId/contestants
export const getContestants = async (req, res) => {
  const { data, error } = await supabase
    .from('contestants')
    .select('*')
    .eq('pageant_id', req.params.pageantId)
    .order('contestant_number');
  if (error) throw error;
  res.json(data);
};

// GET /api/pageants/:pageantId/contestants/:id
export const getContestantById = async (req, res) => {
  const { data, error } = await supabase
    .from('contestants')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Contestant not found.' });
  res.json(data);
};

// POST /api/pageants/:pageantId/contestants
export const createContestant = async (req, res) => {
  const { contestantNumber, firstName, lastName, bio, age, department, photoUrl, gender } = req.body;
  const parsedContestantNumber = parseNumber(contestantNumber);
  if (!parsedContestantNumber || parsedContestantNumber < 1 || !firstName || !lastName) {
    return res.status(400).json({ error: 'contestantNumber, firstName, and lastName are required.' });
  }

  const { data: pageant, error: pageantError } = await supabase
    .from('pageants')
    .select('id, scoring_method')
    .eq('id', req.params.pageantId)
    .single();

  if (pageantError || !pageant) {
    return res.status(404).json({ error: 'Pageant not found.' });
  }

  const normalizedGender = normalizeGender(gender);
  if (normalizedGender === undefined) {
    return res.status(400).json({ error: "gender must be either 'Male' or 'Female'." });
  }

  if (pageant.scoring_method === 'ranking_by_gender' && !normalizedGender) {
    return res.status(400).json({ error: 'gender is required for pageants using ranking_by_gender.' });
  }

  const hasConflict = await hasContestantNumberConflict({
    pageantId: req.params.pageantId,
    contestantNumber: parsedContestantNumber,
    gender: normalizedGender,
    scoringMethod: pageant.scoring_method,
  });

  if (hasConflict) {
    return res.status(409).json({ error: buildContestantNumberConflictMessage(pageant.scoring_method) });
  }

  const { data, error } = await supabase
    .from('contestants')
    .insert({
      pageant_id: req.params.pageantId,
      contestant_number: parsedContestantNumber,
      first_name: firstName,
      last_name: lastName,
      bio: bio || null,
      age: parseNumber(age),
      department: department || null,
      gender: normalizedGender,
      photo_url: photoUrl || null,
      is_active: true,
    })
    .select()
    .single();

  if (error?.code === '23505') {
    return res.status(409).json({ error: buildContestantNumberConflictMessage(pageant.scoring_method) });
  }
  if (error) throw error;

  if (req.file) {
    let uploadedPublicUrl = null;
    try {
      const uploaded = await uploadEntityImage({
        folder: 'contestants',
        recordId: data.id,
        fileBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });
      uploadedPublicUrl = uploaded.publicUrl;

      const { data: withImage, error: updateError } = await persistContestantUploadedPhoto(data.id, uploaded.publicUrl);
      if (updateError) throw updateError;
      return res.status(201).json(withImage);
    } catch (imageError) {
      if (uploadedPublicUrl) {
        try {
          await deleteEntityImageByPublicUrl(uploadedPublicUrl);
        } catch (deleteError) {
          logger.warn('Failed to clean up contestant image after create error:', deleteError?.message || deleteError);
        }
      }

      try {
        await supabase.from('contestants').delete().eq('id', data.id);
      } catch (rollbackError) {
        logger.warn('Failed to rollback contestant row after image error:', rollbackError?.message || rollbackError);
      }

      logger.error('Contestant create image upload failed:', imageError?.message || imageError);
      return res.status(500).json({ error: 'Failed to upload contestant image. Please try again.' });
    }
  }

  res.status(201).json(data);
};

// PATCH /api/pageants/:pageantId/contestants/:id
export const updateContestant = async (req, res) => {
  const { contestantNumber, firstName, lastName, bio, age, department, photoUrl, isActive, gender } = req.body;
  const updates = {};
  if (contestantNumber !== undefined) {
    const parsedContestantNumber = parseNumber(contestantNumber);
    if (!parsedContestantNumber || parsedContestantNumber < 1) {
      return res.status(400).json({ error: 'contestantNumber must be a positive number.' });
    }
    updates.contestant_number = parsedContestantNumber;
  }
  if (firstName !== undefined) updates.first_name = firstName;
  if (lastName !== undefined) updates.last_name = lastName;
  if (bio !== undefined) updates.bio = bio;
  if (age !== undefined) updates.age = parseNumber(age);
  if (department !== undefined) updates.department = department;
  if (gender !== undefined) {
    const normalizedGender = normalizeGender(gender);
    if (normalizedGender === undefined) {
      return res.status(400).json({ error: "gender must be either 'Male' or 'Female'." });
    }
    updates.gender = normalizedGender;
  }
  if (photoUrl !== undefined) updates.photo_url = photoUrl;
  if (isActive !== undefined) updates.is_active = parseBoolean(isActive, true);

  const { data: pageant, error: pageantError } = await supabase
    .from('pageants')
    .select('id, scoring_method')
    .eq('id', req.params.pageantId)
    .single();

  if (pageantError || !pageant) {
    return res.status(404).json({ error: 'Pageant not found.' });
  }

  const { data: existingContestant, error: existingContestantError } = await supabase
    .from('contestants')
    .select('id, contestant_number, gender, photo_path')
    .eq('id', req.params.id)
    .eq('pageant_id', req.params.pageantId)
    .single();

  if (existingContestantError || !existingContestant) {
    return res.status(404).json({ error: 'Contestant not found.' });
  }

  const hasExplicitGenderUpdate = Object.prototype.hasOwnProperty.call(updates, 'gender');
  const resolvedGender = hasExplicitGenderUpdate ? updates.gender : existingContestant.gender;

  if (pageant.scoring_method === 'ranking_by_gender' && !resolvedGender) {
    return res.status(400).json({ error: 'gender is required for pageants using ranking_by_gender.' });
  }

  const resolvedContestantNumber = updates.contestant_number ?? existingContestant.contestant_number;
  const hasConflict = await hasContestantNumberConflict({
    pageantId: req.params.pageantId,
    contestantNumber: resolvedContestantNumber,
    gender: resolvedGender,
    scoringMethod: pageant.scoring_method,
    excludeContestantId: req.params.id,
  });

  if (hasConflict) {
    return res.status(409).json({ error: buildContestantNumberConflictMessage(pageant.scoring_method) });
  }

  if (req.file) {
    try {
      const uploaded = await uploadEntityImage({
        folder: 'contestants',
        recordId: req.params.id,
        fileBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });

      updates.photo_path = uploaded.publicUrl;
      updates.photo_url = uploaded.publicUrl;

      if (existingContestant.photo_path && existingContestant.photo_path !== uploaded.publicUrl) {
        try {
          await deleteEntityImageByPublicUrl(existingContestant.photo_path);
        } catch (deleteErr) {
          logger.warn('Warning: Failed to delete old image:', deleteErr.message);
          // Don't fail the entire update if deletion fails
        }
      }
    } catch (imageErr) {
      logger.error('Image upload error:', imageErr.message);
      throw new Error(`Failed to upload image: ${imageErr.message}`);
    }
  }

  let { data, error } = await supabase
    .from('contestants')
    .update(updates)
    .eq('id', req.params.id)
    .eq('pageant_id', req.params.pageantId)
    .select()
    .single();

  if (error && isUndefinedColumnError(error) && Object.prototype.hasOwnProperty.call(updates, 'photo_path')) {
    const fallbackUpdates = { ...updates };
    delete fallbackUpdates.photo_path;

    const retry = await supabase
      .from('contestants')
      .update(fallbackUpdates)
      .eq('id', req.params.id)
      .eq('pageant_id', req.params.pageantId)
      .select()
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error?.code === '23505') {
    return res.status(409).json({ error: buildContestantNumberConflictMessage(pageant.scoring_method) });
  }
  if (error) throw error;
  res.json(data);
};

// DELETE /api/pageants/:pageantId/contestants/:id
export const deleteContestant = async (req, res) => {
  const { error } = await supabase.from('contestants').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ message: 'Contestant deleted.' });
};
