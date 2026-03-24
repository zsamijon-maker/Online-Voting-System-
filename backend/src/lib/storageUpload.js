import { supabase } from './supabaseClient.js';

const BUCKET_MAP = {
  // The frontend renders direct public URLs, so prefer the known public bucket first.
  candidates: ['candidate-images', 'candidate-photos'],
  contestants: ['candidate-images', 'contestant-photos'],
};

function getBucketCandidates(folder) {
  return BUCKET_MAP[folder] || ['uploads'];
}

function sanitizeSegment(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
}

function extensionFromMime(mimeType) {
  if (mimeType === 'image/png') return 'png';
  return 'jpg';
}

function buildStoragePath(folder, recordId, mimeType) {
  const safeFolder = sanitizeSegment(folder);
  const safeId = sanitizeSegment(recordId);
  const timestamp = Date.now();
  const ext = extensionFromMime(mimeType);

  const baseName = safeFolder === 'candidates'
    ? `candidate_${safeId}_${timestamp}`
    : `contestant_${safeId}_${timestamp}`;

  return `${safeFolder}/${baseName}.${ext}`;
}

export async function uploadEntityImage({ folder, recordId, fileBuffer, mimeType }) {
  const bucketCandidates = getBucketCandidates(folder);
  const storagePath = buildStoragePath(folder, recordId, mimeType);

  let uploadError = null;
  let usedBucket = null;

  for (const bucketName of bucketCandidates) {
    const { error } = await supabase
      .storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (!error) {
      usedBucket = bucketName;
      uploadError = null;
      break;
    }

    uploadError = error;
  }

  if (uploadError || !usedBucket) throw uploadError || new Error('Failed to upload image.');

  const { data: publicData } = supabase
    .storage
    .from(usedBucket)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: publicData.publicUrl,
  };
}

export function extractStoragePathFromPublicUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null;

  // Expected shape: .../storage/v1/object/public/{bucket-name}/<path>
  // Extract everything after /public/
  const marker = '/storage/v1/object/public/';
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;

  const afterPublic = publicUrl.slice(index + marker.length);
  // Remove the bucket name from the path
  // afterPublic looks like: "candidate-photos/contestants/..." or "contestant-photos/contestants/..."
  const parts = afterPublic.split('/');
  const objectPath = parts.slice(1).join('/');
  return objectPath || null;
}

export async function deleteEntityImageByPublicUrl(publicUrl) {
  const storagePath = extractStoragePathFromPublicUrl(publicUrl);
  if (!storagePath) return;

  // Determine bucket from URL
  const markers = {
    'candidate-images': '/candidate-images/',
    'candidate-photos': '/candidate-photos/',
    'contestant-photos': '/contestant-photos/',
  };

  let bucketName = 'uploads';
  for (const [bucket, marker] of Object.entries(markers)) {
    if (publicUrl.includes(marker)) {
      bucketName = bucket;
      break;
    }
  }

  await supabase.storage.from(bucketName).remove([storagePath]);
}
