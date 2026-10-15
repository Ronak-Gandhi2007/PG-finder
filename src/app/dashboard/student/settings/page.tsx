'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePersona } from '@/context/PersonaContext';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/image-compression';

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'ST';
}

export default function StudentSettings() {
  const { user, profile, refreshProfile } = usePersona();
  const supabase = createClient();

  const isPlaceholderMode =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.includes('placeholder');

  const isDemo = process.env.NODE_ENV === 'development' && isPlaceholderMode && !user;

  // Form Fields
  const [name, setName] = useState(() => (isDemo ? 'Aarav Malhotra' : ''));
  const [email, setEmail] = useState(() => (isDemo ? 'aarav@student.in' : ''));
  const [college, setCollege] = useState(() => (isDemo ? 'IIT Delhi' : ''));
  const [phone, setPhone] = useState(() => (isDemo ? '+91 98989 89898' : ''));

  // Form State
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Avatar State
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarStatusText, setAvatarStatusText] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Student ID State
  const [idUploading, setIdUploading] = useState(false);
  const [idStatusText, setIdStatusText] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [idSuccess, setIdSuccess] = useState<string | null>(null);
  const [signedDocUrl, setSignedDocUrl] = useState<string | null>(null);
  const [isLoadingDocUrl, setIsLoadingDocUrl] = useState(false);
  const idInputRef = useRef<HTMLInputElement>(null);

  // Load existing profile values
  useEffect(() => {
    if (profile) {
      if (profile.full_name) setName(profile.full_name);
      if (profile.email) setEmail(profile.email);
      else if (user?.email) setEmail(user.email);
      if (profile.college_name) setCollege(profile.college_name);
      if (profile.phone) setPhone(profile.phone);
    } else if (user) {
      if (user.user_metadata?.full_name) setName(user.user_metadata.full_name);
      if (user.email) setEmail(user.email);
      if (user.user_metadata?.college_name) setCollege(user.user_metadata.college_name);
      if (user.user_metadata?.phone) setPhone(user.user_metadata.phone);
    }
  }, [profile, user]);

  // Fetch signed URL for private student ID document if present
  const fetchSignedDocUrl = useCallback(
    async (docPath: string) => {
      if (isPlaceholderMode || !user) return;
      setIsLoadingDocUrl(true);
      try {
        const { data, error } = await supabase.storage
          .from('student-id-documents')
          .createSignedUrl(docPath, 3600); // 1 hour access

        if (error) {
          console.warn('Could not generate signed URL for document:', error.message);
          setSignedDocUrl(null);
        } else if (data?.signedUrl) {
          setSignedDocUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Exception fetching signed doc URL:', err);
      } finally {
        setIsLoadingDocUrl(false);
      }
    },
    [isPlaceholderMode, user, supabase]
  );

  useEffect(() => {
    if (profile?.student_id_doc_url) {
      fetchSignedDocUrl(profile.student_id_doc_url);
    } else {
      setSignedDocUrl(null);
    }
  }, [profile?.student_id_doc_url, fetchSignedDocUrl]);

  // Handle saving personal details
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (isPlaceholderMode || !user) {
      setProfileSuccess('Settings updated successfully (Demo Mode)!');
      setTimeout(() => setProfileSuccess(null), 3000);
      return;
    }

    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: name.trim(),
          college_name: college.trim(),
          phone: phone.trim(),
        })
        .eq('id', user.id);

      if (error) {
        setProfileError(error.message);
      } else {
        await refreshProfile();
        setProfileSuccess('Personal details updated successfully!');
        setTimeout(() => setProfileSuccess(null), 3500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings. Please try again.';
      setProfileError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Avatar upload to public bucket 'user-avatars'
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setAvatarSuccess(null);

    // Validate type
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validExtensions = /\.(jpe?g|png|webp)$/i;
    if (!validImageTypes.includes(file.type) && !validExtensions.test(file.name)) {
      setAvatarError('Invalid image type. Please select a JPG, PNG, or WebP image.');
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }

    // Validate size limit (<= 15MB before compression)
    if (file.size > 15 * 1024 * 1024) {
      setAvatarError('Image is too large. Please select an image under 15 MB.');
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }

    if (isPlaceholderMode || !user) {
      setAvatarSuccess('Avatar updated (Demo mode).');
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }

    setAvatarUploading(true);
    try {
      // 1. Compress image in browser using canvas
      setAvatarStatusText('Compressing avatar…');
      const compressed = await compressImage(file, {
        maxSide: 600,
        initialQuality: 0.85,
        maxSizeBytes: 2 * 1024 * 1024,
        preferredType: 'image/webp',
      });

      // 2. Upload to public bucket 'user-avatars'
      setAvatarStatusText('Uploading to storage…');
      const timestamp = Date.now();
      const storagePath = `${user.id}/avatar_${timestamp}.${compressed.extension}`;

      const { error: uploadErr } = await supabase.storage
        .from('user-avatars')
        .upload(storagePath, compressed.blob, {
          contentType: compressed.mimeType,
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      // 3. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(storagePath);

      const publicUrl = publicUrlData.publicUrl;

      // 4. Update profiles table
      setAvatarStatusText('Updating profile…');
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      // 5. Clean up old avatar if it was stored in user-avatars
      if (profile?.avatar_url && profile.avatar_url.includes('/user-avatars/')) {
        try {
          const oldUrl = new URL(profile.avatar_url);
          const match = oldUrl.pathname.match(/user-avatars\/(.+)$/);
          if (match && match[1] && match[1] !== storagePath) {
            await supabase.storage.from('user-avatars').remove([match[1]]);
          }
        } catch {
          // Non-critical cleanup failure can be ignored
        }
      }

      await refreshProfile();
      setAvatarSuccess('Avatar updated successfully!');
      setTimeout(() => setAvatarSuccess(null), 3000);
    } catch (err: unknown) {
      console.error('Avatar upload error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to upload avatar. Please try again.';
      setAvatarError(msg);
    } finally {
      setAvatarUploading(false);
      setAvatarStatusText(null);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Handle Avatar removal
  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url) return;
    setAvatarError(null);
    setAvatarSuccess(null);

    if (isPlaceholderMode || !user) {
      setAvatarSuccess('Avatar removed (Demo mode).');
      return;
    }

    setAvatarUploading(true);
    setAvatarStatusText('Removing avatar…');
    try {
      // 1. Remove from storage if possible
      if (profile.avatar_url.includes('/user-avatars/')) {
        try {
          const urlObj = new URL(profile.avatar_url);
          const match = urlObj.pathname.match(/user-avatars\/(.+)$/);
          if (match && match[1]) {
            await supabase.storage.from('user-avatars').remove([match[1]]);
          }
        } catch {
          // Ignore parse errors
        }
      }

      // 2. Set profile avatar_url to null
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      await refreshProfile();
      setAvatarSuccess('Avatar removed successfully.');
      setTimeout(() => setAvatarSuccess(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove avatar.';
      setAvatarError(msg);
    } finally {
      setAvatarUploading(false);
      setAvatarStatusText(null);
    }
  };

  // Handle Student ID Upload to private bucket 'student-id-documents'
  const handleStudentIdSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIdError(null);
    setIdSuccess(null);

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage =
      file.type === 'image/jpeg' ||
      file.type === 'image/png' ||
      /\.(jpe?g|png)$/i.test(file.name);

    // Validate type (jpg/png/pdf)
    if (!isPdf && !isImage) {
      setIdError('Invalid file type. Only PDF, PNG, and JPG files are accepted.');
      if (idInputRef.current) idInputRef.current.value = '';
      return;
    }

    // Validate initial size
    const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5 MB
    if (isPdf && file.size > MAX_DOC_SIZE) {
      setIdError(`PDF size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 5 MB limit. Please select a smaller PDF.`);
      if (idInputRef.current) idInputRef.current.value = '';
      return;
    }

    if (!isPdf && file.size > 15 * 1024 * 1024) {
      setIdError('Original image exceeds 15 MB. Please select a smaller image.');
      if (idInputRef.current) idInputRef.current.value = '';
      return;
    }

    if (isPlaceholderMode || !user) {
      setIdSuccess('Document submitted (Demo mode)!');
      if (idInputRef.current) idInputRef.current.value = '';
      return;
    }

    setIdUploading(true);
    try {
      let uploadPayload: Blob = file;
      let extension = 'pdf';
      let contentType = 'application/pdf';

      if (isImage) {
        setIdStatusText('Compressing document image…');
        const compressed = await compressImage(file, {
          maxSide: 1600,
          initialQuality: 0.8,
          maxSizeBytes: MAX_DOC_SIZE,
          preferredType: 'image/jpeg',
        });
        uploadPayload = compressed.blob;
        extension = compressed.extension;
        contentType = compressed.mimeType;
      } else {
        setIdStatusText('Preparing document…');
      }

      // Check size after compression
      if (uploadPayload.size > MAX_DOC_SIZE) {
        throw new Error('Document size exceeds the 5 MB limit after processing.');
      }

      // Storage path: only {user_id}/...
      const timestamp = Date.now();
      const storagePath = `${user.id}/student_id_${timestamp}.${extension}`;

      setIdStatusText('Uploading to secure private storage…');
      const { error: uploadErr } = await supabase.storage
        .from('student-id-documents')
        .upload(storagePath, uploadPayload, {
          contentType,
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      // Save only the storage path in profiles.student_id_doc_url
      setIdStatusText('Recording verification status…');
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          student_id_doc_url: storagePath,
          student_id_rejection_reason: null,
        })
        .eq('id', user.id);

      if (profileErr) {
        throw new Error(profileErr.message);
      }

      // Clean up previous document file if present
      const oldPath = profile?.student_id_doc_url;
      if (oldPath && oldPath !== storagePath) {
        try {
          await supabase.storage.from('student-id-documents').remove([oldPath]);
        } catch {
          // Non-critical cleanup
        }
      }

      await refreshProfile();
      await fetchSignedDocUrl(storagePath);
      setIdSuccess('Student ID uploaded and submitted for verification!');
      setTimeout(() => setIdSuccess(null), 4000);
    } catch (err: unknown) {
      console.error('Student ID upload error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to upload student ID document.';
      setIdError(msg);
    } finally {
      setIdUploading(false);
      setIdStatusText(null);
      if (idInputRef.current) idInputRef.current.value = '';
    }
  };

  // Handle Student ID Removal
  const handleRemoveStudentId = async () => {
    if (!profile?.student_id_doc_url) return;
    setIdError(null);
    setIdSuccess(null);

    if (isPlaceholderMode || !user) {
      setIdSuccess('Document removed (Demo mode).');
      return;
    }

    setIdUploading(true);
    setIdStatusText('Removing document…');
    try {
      const docPath = profile.student_id_doc_url;

      // 1. Delete from private bucket
      await supabase.storage.from('student-id-documents').remove([docPath]);

      // 2. Clear path in profiles table
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ student_id_doc_url: null })
        .eq('id', user.id);

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      setSignedDocUrl(null);
      await refreshProfile();
      setIdSuccess('Student ID document removed.');
      setTimeout(() => setIdSuccess(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove document.';
      setIdError(msg);
    } finally {
      setIdUploading(false);
      setIdStatusText(null);
    }
  };

  const studentName = name || profile?.full_name || 'Student';
  const initials = getInitials(studentName, email);
  const currentAvatarUrl = profile?.avatar_url || null;
  const hasIdDoc = Boolean(profile?.student_id_doc_url);

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Profile & Avatar Section ─── */}
      <section className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-primary">Account Settings</h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Manage your personal details, profile avatar, and verified college information.
          </p>
        </div>

        {profileSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-xs font-bold text-deep-green flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {profileSuccess}
          </div>
        )}

        {profileError && (
          <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {profileError}
          </div>
        )}

        {/* Avatar Upload Sub-card */}
        <div className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low/40 flex flex-col sm:flex-row items-center gap-5">
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-deep-green/30 bg-surface-container-high flex items-center justify-center shadow-sm">
              {currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt={studentName}
                  className="object-cover w-full h-full"
                />
              ) : (
                <span className="font-bold text-deep-green text-xl select-none">
                  {initials}
                </span>
              )}
            </div>

            {avatarUploading && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-white animate-spin text-2xl">
                  progress_activity
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-sm font-bold text-[#333333]">Profile Avatar</span>
              {profile?.is_verified && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-deep-green font-bold px-2 py-0.5 rounded-full">
                  <span className="material-symbols-outlined text-[12px]">verified</span>
                  Verified
                </span>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Upload a clear photo of yourself. Accepts JPG, PNG, or WebP up to 5 MB (automatically compressed).
            </p>

            {avatarStatusText && (
              <span className="text-xs font-semibold text-primary flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                {avatarStatusText}
              </span>
            )}

            {avatarSuccess && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check</span>
                {avatarSuccess}
              </span>
            )}

            {avatarError && (
              <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {avatarError}
              </span>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={avatarUploading}
                onChange={handleAvatarSelect}
              />
              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
                className="bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {currentAvatarUrl ? 'Change Avatar' : 'Upload Avatar'}
              </button>

              {currentAvatarUrl && (
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={handleRemoveAvatar}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleProfileSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#7A8F7A]">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aarav Malhotra"
              className="w-full px-3 py-2 border border-[#B8D9B0] rounded-lg text-sm focus:border-primary outline-none bg-white transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#7A8F7A]">Email Address</label>
              <span className="text-[10px] text-on-surface-variant font-medium">(Managed by login auth)</span>
            </div>
            <input
              type="email"
              disabled
              value={email}
              readOnly
              className="w-full px-3 py-2 border border-outline-variant/60 rounded-lg text-sm bg-surface-container-low/60 text-on-surface-variant cursor-not-allowed outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#7A8F7A]">Phone Number</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2 border border-[#B8D9B0] rounded-lg text-sm focus:border-primary outline-none bg-white transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#7A8F7A]">College / University Name</label>
            <input
              type="text"
              required
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="e.g. PCCOE Pune"
              className="w-full px-3 py-2 border border-[#B8D9B0] rounded-lg text-sm focus:border-primary outline-none bg-white transition-colors"
            />
          </div>

          <div className="md:col-span-2 pt-2 border-t border-outline-variant mt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="bg-deep-green hover:bg-primary text-on-primary font-bold text-xs px-6 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSavingProfile && (
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              )}
              {isSavingProfile ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>

      {/* ─── ID Verification Section (Private Storage) ─── */}
      <section className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#333333]">Student ID Verification</h2>
            <p className="text-xs text-on-surface-variant mt-1">
              Upload your official college ID card or admission proof. Stored securely in a private vault, accessible only to you and system administrators.
            </p>
          </div>

          {/* Verification Badge */}
          <div className="self-start md:self-auto">
            {profile?.is_verified ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-deep-green text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-300">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Verified Student
              </span>
            ) : profile?.student_id_rejection_reason ? (
              <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 text-xs font-bold px-3 py-1.5 rounded-full border border-rose-300">
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                Verification Rejected
              </span>
            ) : hasIdDoc ? (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-300">
                <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                Verification Pending
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-stone-100 text-stone-600 text-xs font-bold px-3 py-1.5 rounded-full border border-stone-300">
                <span className="material-symbols-outlined text-[16px]">shield</span>
                Not Verified
              </span>
            )}
          </div>
        </div>

        {profile?.student_id_rejection_reason && !profile?.is_verified && (
          <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl text-xs text-rose-800 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-rose-900">
              <span className="material-symbols-outlined text-[18px]">info</span>
              Document Rejected by Administrator
            </div>
            <p>
              <strong>Reason:</strong> {profile.student_id_rejection_reason}
            </p>
            <p className="text-[11px] text-rose-700 mt-0.5">
              Please review the feedback above and upload a clearer, valid document to re-verify.
            </p>
          </div>
        )}

        {idSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-xs font-bold text-deep-green flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {idSuccess}
          </div>
        )}

        {idError && (
          <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {idError}
          </div>
        )}

        {/* Upload Container */}
        <div className="border-2 border-dashed border-[#B8D9B0] rounded-xl p-6 text-center flex flex-col items-center gap-3 bg-surface-container-low/20">
          <span className="material-symbols-outlined text-4xl text-outline">
            {hasIdDoc ? 'task_alt' : 'badge'}
          </span>

          <div className="max-w-md">
            <span className="text-xs font-bold text-primary block">
              {idUploading
                ? idStatusText || 'Processing document…'
                : hasIdDoc
                ? 'College ID Document Submitted'
                : 'Upload Student College ID'}
            </span>
            <span className="text-[11px] text-on-surface-variant block mt-1">
              {hasIdDoc
                ? `Saved to private vault: ${profile?.student_id_doc_url}`
                : 'Accepts PDF, PNG, or JPG files (up to 5 MB). Images are automatically compressed before upload.'}
            </span>
          </div>

          <input
            ref={idInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png"
            className="hidden"
            disabled={idUploading}
            onChange={handleStudentIdSelect}
          />

          {!hasIdDoc && !idUploading && (
            <button
              type="button"
              onClick={() => idInputRef.current?.click()}
              className="bg-light-sage hover:bg-light-sage/80 text-deep-green text-xs font-bold px-5 py-2.5 rounded-lg cursor-pointer transition-colors shadow-sm mt-1"
            >
              Browse Files
            </button>
          )}

          {hasIdDoc && !idUploading && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              {signedDocUrl ? (
                <a
                  href={signedDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-deep-green bg-white border border-[#B8D9B0] px-3.5 py-1.5 rounded-lg shadow-2xs hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  View Submitted Document
                </a>
              ) : isLoadingDocUrl ? (
                <span className="text-xs text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  Loading secure link…
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => idInputRef.current?.click()}
                className="text-xs font-bold text-deep-green hover:underline cursor-pointer px-2 py-1"
              >
                Replace File
              </button>

              <button
                type="button"
                onClick={handleRemoveStudentId}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer px-2 py-1"
              >
                Remove
              </button>
            </div>
          )}

          {idUploading && (
            <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-primary">
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              {idStatusText || 'Please wait…'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
