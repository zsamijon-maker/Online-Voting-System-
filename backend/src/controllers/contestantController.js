import { supabase } from '../lib/supabaseClient.js';
import { uploadEntityImage, deleteEntityImageByPublicUrl } from '../lib/storageUpload.js';

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
    const uploaded = await uploadEntityImage({
      folder: 'contestants',
      recordId: data.id,
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    const { data: withImage, error: updateError } = await supabase
      .from('contestants')
      .update({ photo_path: uploaded.publicUrl })
      .eq('id', data.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return res.status(201).json(withImage);
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

      if (existingContestant.photo_path && existingContestant.photo_path !== uploaded.publicUrl) {
        try {
          await deleteEntityImageByPublicUrl(existingContestant.photo_path);
        } catch (deleteErr) {
          console.warn('Warning: Failed to delete old image:', deleteErr.message);
          // Don't fail the entire update if deletion fails
        }
      }
    } catch (imageErr) {
      console.error('Image upload error:', imageErr.message);
      throw new Error(`Failed to upload image: ${imageErr.message}`);
    }
  }

  const { data, error } = await supabase
    .from('contestants')
    .update(updates)
    .eq('id', req.params.id)
    .eq('pageant_id', req.params.pageantId)
    .select()
    .single();

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
