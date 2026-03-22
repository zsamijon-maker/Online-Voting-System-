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
  const { contestantNumber, firstName, lastName, bio, age, department, photoUrl } = req.body;
  if (!contestantNumber || !firstName || !lastName) {
    return res.status(400).json({ error: 'contestantNumber, firstName, and lastName are required.' });
  }

  const { data, error } = await supabase
    .from('contestants')
    .insert({
      pageant_id: req.params.pageantId,
      contestant_number: contestantNumber,
      first_name: firstName,
      last_name: lastName,
      bio: bio || null,
      age: parseNumber(age),
      department: department || null,
      photo_url: photoUrl || null,
      is_active: true,
    })
    .select()
    .single();

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
  const { contestantNumber, firstName, lastName, bio, age, department, photoUrl, isActive } = req.body;
  const updates = {};
  if (contestantNumber !== undefined) updates.contestant_number = contestantNumber;
  if (firstName !== undefined) updates.first_name = firstName;
  if (lastName !== undefined) updates.last_name = lastName;
  if (bio !== undefined) updates.bio = bio;
  if (age !== undefined) updates.age = parseNumber(age);
  if (department !== undefined) updates.department = department;
  if (photoUrl !== undefined) updates.photo_url = photoUrl;
  if (isActive !== undefined) updates.is_active = parseBoolean(isActive, true);

  if (req.file) {
    try {
      const { data: existing, error: existingError } = await supabase
        .from('contestants')
        .select('photo_path')
        .eq('id', req.params.id)
        .single();

      if (existingError) throw existingError;

      const uploaded = await uploadEntityImage({
        folder: 'contestants',
        recordId: req.params.id,
        fileBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });

      updates.photo_path = uploaded.publicUrl;

      if (existing?.photo_path && existing.photo_path !== uploaded.publicUrl) {
        try {
          await deleteEntityImageByPublicUrl(existing.photo_path);
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
    .select()
    .single();

  if (error) throw error;
  res.json(data);
};

// DELETE /api/pageants/:pageantId/contestants/:id
export const deleteContestant = async (req, res) => {
  const { error } = await supabase.from('contestants').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ message: 'Contestant deleted.' });
};
