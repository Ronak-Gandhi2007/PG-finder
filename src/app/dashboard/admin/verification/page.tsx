'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePersona } from '@/context/PersonaContext';

interface StudentDocItem {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  college_name: string | null;
  student_id_doc_url: string;
  is_verified: boolean;
  student_id_rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface OwnerInfo {
  id?: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
}

interface ListingItem {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string;
  location_name: string;
  address: string;
  base_price: number;
  gender_type: string;
  is_verified: boolean;
  is_active: boolean;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  owner?: OwnerInfo;
}

type TabType = 'students' | 'listings';
type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminVerification() {
  const supabase = createClient();
  const { user } = usePersona();

  const [activeTab, setActiveTab] = useState<TabType>('students');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [studentDocs, setStudentDocs] = useState<StudentDocItem[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // On-demand short-lived signed URL state
  const [generatingUrlFor, setGeneratingUrlFor] = useState<string | null>(null);

  // Rejection modal state
  const [rejectingItem, setRejectingItem] = useState<{
    type: 'student' | 'listing';
    id: string;
    title: string;
    targetUserId: string;
  } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

  // Processing state for inline approvals
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch real verification items from Supabase
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);

    try {
      // 1. Fetch real student ID documents
      const { data: studentsData, error: studentsErr } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          phone,
          college_name,
          student_id_doc_url,
          is_verified,
          student_id_rejection_reason,
          created_at,
          updated_at
        `)
        .eq('role', 'STUDENT')
        .not('student_id_doc_url', 'is', null)
        .order('updated_at', { ascending: false });

      if (studentsErr) {
        throw new Error(`Failed to load student documents: ${studentsErr.message}`);
      }

      setStudentDocs((studentsData as unknown as StudentDocItem[]) || []);

      // 2. Fetch real properties with owner profiles
      const { data: propertiesData, error: propsErr } = await supabase
        .from('properties')
        .select(`
          id,
          owner_id,
          title,
          slug,
          description,
          location_name,
          address,
          base_price,
          gender_type,
          is_verified,
          is_active,
          rejection_reason,
          created_at,
          updated_at,
          owner:owner_id(id, full_name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (propsErr) {
        throw new Error(`Failed to load listings: ${propsErr.message}`);
      }

      const formattedListings = (propertiesData || []).map((p: any) => ({
        ...p,
        owner: Array.isArray(p.owner) ? p.owner[0] : p.owner,
      }));

      setListings(formattedListings);
    } catch (err: unknown) {
      console.error('Error loading verification pipeline:', err);
      setActionError(err instanceof Error ? err.message : 'Error loading verification pipeline.');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // On-demand short-lived signed URL generation (Admins only, 60s validity)
  const handleViewStudentDoc = async (item: StudentDocItem) => {
    setActionError(null);
    setGeneratingUrlFor(item.id);

    try {
      // Generate a short-lived 60-second signed URL on demand
      const { data, error } = await supabase.storage
        .from('student-id-documents')
        .createSignedUrl(item.student_id_doc_url, 60);

      if (error) {
        throw new Error(`Could not generate secure view URL: ${error.message}`);
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('No signed URL returned from storage service.');
      }
    } catch (err: unknown) {
      console.error('On-demand signed URL error:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to generate secure viewing link.');
    } finally {
      setGeneratingUrlFor(null);
    }
  };

  // Approve Student ID Document
  const handleApproveStudent = async (student: StudentDocItem) => {
    setActionError(null);
    setActionSuccess(null);
    setProcessingId(student.id);

    try {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          is_verified: true,
          student_id_rejection_reason: null,
        })
        .eq('id', student.id);

      if (profileErr) {
        throw new Error(profileErr.message);
      }

      // Send in-app notification to student
      await supabase.from('notifications').insert({
        user_id: student.id,
        title: 'Student ID Verified',
        message: 'Your college ID document has been reviewed and verified by an administrator. You now have the Verified Student badge!',
        type: 'verification_approved',
        link_url: '/dashboard/student/settings',
      });

      setActionSuccess(`Approved verification for student ${student.full_name}.`);
      setTimeout(() => setActionSuccess(null), 4000);

      // Optimistic state update
      setStudentDocs((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? { ...s, is_verified: true, student_id_rejection_reason: null }
            : s
        )
      );
    } catch (err: unknown) {
      console.error('Student approval error:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to approve student.');
    } finally {
      setProcessingId(null);
    }
  };

  // Approve Property Listing
  const handleApproveListing = async (listing: ListingItem) => {
    setActionError(null);
    setActionSuccess(null);
    setProcessingId(listing.id);

    try {
      const { error: propErr } = await supabase
        .from('properties')
        .update({
          is_verified: true,
          rejection_reason: null,
          is_active: true,
        })
        .eq('id', listing.id);

      if (propErr) {
        throw new Error(propErr.message);
      }

      // Send in-app notification to owner
      await supabase.from('notifications').insert({
        user_id: listing.owner_id,
        title: 'Listing Approved & Live',
        message: `Your property listing "${listing.title}" has been verified by the administrator and is now live for student discovery!`,
        type: 'verification_approved',
        link_url: '/dashboard/owner/listings',
      });

      setActionSuccess(`Listing "${listing.title}" is now verified and live.`);
      setTimeout(() => setActionSuccess(null), 4000);

      // Optimistic state update
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? { ...l, is_verified: true, rejection_reason: null, is_active: true }
            : l
        )
      );
    } catch (err: unknown) {
      console.error('Listing approval error:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to approve listing.');
    } finally {
      setProcessingId(null);
    }
  };

  // Submit Rejection with Reason Modal
  const handleSubmitRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;

    const trimmedReason = rejectionReasonInput.trim();
    if (!trimmedReason) {
      setActionError('Please provide a specific rejection reason.');
      return;
    }

    setIsSubmittingRejection(true);
    setActionError(null);

    try {
      if (rejectingItem.type === 'student') {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({
            is_verified: false,
            student_id_rejection_reason: trimmedReason,
          })
          .eq('id', rejectingItem.id);

        if (profileErr) throw new Error(profileErr.message);

        // Notify student with reason
        await supabase.from('notifications').insert({
          user_id: rejectingItem.targetUserId,
          title: 'Student ID Verification Rejected',
          message: `Your student ID document was rejected: "${trimmedReason}". Please upload a clearer or valid document in your settings.`,
          type: 'verification_rejected',
          link_url: '/dashboard/student/settings',
        });

        setActionSuccess(`Rejected student ID verification for ${rejectingItem.title}.`);

        setStudentDocs((prev) =>
          prev.map((s) =>
            s.id === rejectingItem.id
              ? { ...s, is_verified: false, student_id_rejection_reason: trimmedReason }
              : s
          )
        );
      } else {
        const { error: propErr } = await supabase
          .from('properties')
          .update({
            is_verified: false,
            rejection_reason: trimmedReason,
          })
          .eq('id', rejectingItem.id);

        if (propErr) throw new Error(propErr.message);

        // Notify owner with reason
        await supabase.from('notifications').insert({
          user_id: rejectingItem.targetUserId,
          title: 'Property Listing Rejected',
          message: `Your listing "${rejectingItem.title}" was not approved: "${trimmedReason}". Please review and update your listing details.`,
          type: 'verification_rejected',
          link_url: '/dashboard/owner/listings',
        });

        setActionSuccess(`Rejected listing "${rejectingItem.title}".`);

        setListings((prev) =>
          prev.map((l) =>
            l.id === rejectingItem.id
              ? { ...l, is_verified: false, rejection_reason: trimmedReason }
              : l
          )
        );
      }

      setRejectingItem(null);
      setRejectionReasonInput('');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      console.error('Rejection submit error:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to reject item.');
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  // Counts for Badges
  const pendingStudentsCount = useMemo(
    () => studentDocs.filter((s) => !s.is_verified && !s.student_id_rejection_reason).length,
    [studentDocs]
  );

  const pendingListingsCount = useMemo(
    () => listings.filter((l) => !l.is_verified && !l.rejection_reason).length,
    [listings]
  );

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return studentDocs.filter((s) => {
      const isPending = !s.is_verified && !s.student_id_rejection_reason;
      const isApproved = s.is_verified;
      const isRejected = !s.is_verified && Boolean(s.student_id_rejection_reason);

      if (filterStatus === 'pending' && !isPending) return false;
      if (filterStatus === 'approved' && !isApproved) return false;
      if (filterStatus === 'rejected' && !isRejected) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.full_name?.toLowerCase().includes(q);
        const matchEmail = s.email?.toLowerCase().includes(q);
        const matchCollege = s.college_name?.toLowerCase().includes(q);
        return matchName || matchEmail || matchCollege;
      }

      return true;
    });
  }, [studentDocs, filterStatus, searchQuery]);

  // Filtered listings list
  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      const isPending = !l.is_verified && !l.rejection_reason;
      const isApproved = l.is_verified;
      const isRejected = !l.is_verified && Boolean(l.rejection_reason);

      if (filterStatus === 'pending' && !isPending) return false;
      if (filterStatus === 'approved' && !isApproved) return false;
      if (filterStatus === 'rejected' && !isRejected) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = l.title.toLowerCase().includes(q);
        const matchLoc = l.location_name.toLowerCase().includes(q);
        const matchOwner = l.owner?.full_name?.toLowerCase().includes(q);
        return matchTitle || matchLoc || matchOwner;
      }

      return true;
    });
  }, [listings, filterStatus, searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Header ─── */}
      <div className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary">Admin Verification Pipeline</h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Authoritative review portal: inspect submitted student ID proofs and newly registered PG accommodations.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="self-start md:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#B8D9B0] bg-white hover:bg-surface-container-low text-primary text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
            sync
          </span>
          Refresh Pipeline
        </button>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-xs font-bold text-deep-green flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {actionError}
        </div>
      )}

      {/* ─── Tabs & Controls ─── */}
      <div className="bg-white rounded-card p-4 shadow-level-1 border border-outline-variant flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-3">
          {/* Main Pipeline Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-deep-green text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">school</span>
              Student ID Proofs
              {pendingStudentsCount > 0 && (
                <span className="bg-amber-400 text-stone-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {pendingStudentsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('listings')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'listings'
                  ? 'bg-deep-green text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">apartment</span>
              Pending Listings
              {pendingListingsCount > 0 && (
                <span className="bg-amber-400 text-stone-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {pendingListingsCount}
                </span>
              )}
            </button>
          </div>

          {/* Sub-filters (Status) */}
          <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg border border-outline-variant/60">
            {(['pending', 'approved', 'rejected', 'all'] as FilterStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md capitalize transition-colors cursor-pointer ${
                  filterStatus === st
                    ? 'bg-white text-primary shadow-2xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'students'
                ? 'Search students by name, email, or college...'
                : 'Search listings by title, location, or owner...'
            }
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#B8D9B0] rounded-lg text-xs text-primary focus:border-primary outline-none transition-colors"
          />
        </div>
      </div>

      {/* ─── Pipeline Content ─── */}
      {isLoading ? (
        <div className="bg-white rounded-card p-12 text-center flex flex-col items-center justify-center gap-3 border border-outline-variant shadow-level-1">
          <span className="w-8 h-8 border-3 border-deep-green border-t-transparent rounded-full animate-spin"></span>
          <span className="text-xs text-on-surface-variant font-medium">
            Fetching verification requests from Supabase…
          </span>
        </div>
      ) : activeTab === 'students' ? (
        /* ─── Student ID Proofs List ─── */
        <div className="flex flex-col gap-4">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((student) => {
              const isPending = !student.is_verified && !student.student_id_rejection_reason;
              const isApproved = student.is_verified;
              const isRejected = !student.is_verified && Boolean(student.student_id_rejection_reason);

              return (
                <div
                  key={student.id}
                  className="bg-white rounded-card p-5 border border-outline-variant shadow-level-1 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-bold text-primary text-sm">{student.full_name}</h3>
                      {isApproved && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">verified</span>
                          Verified
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">cancel</span>
                          Rejected
                        </span>
                      )}
                      {isPending && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">hourglass_top</span>
                          Pending Review
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-on-surface-variant">
                      <p>
                        Email: <strong className="text-[#333333] font-semibold">{student.email}</strong>
                      </p>
                      <p>
                        Phone: <strong className="text-[#333333] font-semibold">{student.phone || 'Not provided'}</strong>
                      </p>
                      <p>
                        College: <strong className="text-[#333333] font-semibold">{student.college_name || 'Not provided'}</strong>
                      </p>
                      <p className="sm:col-span-2">
                        Vault Path: <span className="font-mono text-[11px] text-primary">{student.student_id_doc_url}</span>
                      </p>
                    </div>

                    {student.student_id_rejection_reason && (
                      <div className="mt-1 p-2.5 bg-rose-50/70 border border-rose-200 rounded-lg text-xs text-rose-800">
                        <strong>Rejection Reason:</strong> {student.student_id_rejection_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 self-end lg:self-center shrink-0">
                    <button
                      onClick={() => handleViewStudentDoc(student)}
                      disabled={generatingUrlFor === student.id}
                      className="px-3.5 py-2 border border-[#B8D9B0] bg-white hover:bg-surface-container-low text-primary rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {generatingUrlFor === student.id ? 'sync' : 'visibility'}
                      </span>
                      {generatingUrlFor === student.id ? 'Generating link…' : 'View ID (60s signed link)'}
                    </button>

                    {isPending && (
                      <>
                        <button
                          onClick={() => {
                            setRejectingItem({
                              type: 'student',
                              id: student.id,
                              title: student.full_name,
                              targetUserId: student.id,
                            });
                            setRejectionReasonInput('');
                          }}
                          className="px-3.5 py-2 border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveStudent(student)}
                          disabled={processingId === student.id}
                          className="px-4 py-2 bg-deep-green hover:bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {processingId === student.id && (
                            <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                          )}
                          Approve
                        </button>
                      </>
                    )}

                    {!isPending && (
                      <button
                        onClick={() => {
                          setRejectingItem({
                            type: 'student',
                            id: student.id,
                            title: student.full_name,
                            targetUserId: student.id,
                          });
                          setRejectionReasonInput(student.student_id_rejection_reason || '');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-rose-700 hover:underline cursor-pointer"
                      >
                        Change Status
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-card p-12 text-center flex flex-col items-center justify-center gap-3 border border-outline-variant shadow-level-1">
              <span className="material-symbols-outlined text-5xl text-outline-variant">school</span>
              <p className="text-sm font-bold text-primary">No student documents match the selected filter.</p>
              <p className="text-xs text-on-surface-variant">
                When students upload their college IDs, they will appear in this pipeline for review.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ─── Property Listings List ─── */
        <div className="flex flex-col gap-4">
          {filteredListings.length > 0 ? (
            filteredListings.map((listing) => {
              const isPending = !listing.is_verified && !listing.rejection_reason;
              const isApproved = listing.is_verified;
              const isRejected = !listing.is_verified && Boolean(listing.rejection_reason);

              return (
                <div
                  key={listing.id}
                  className="bg-white rounded-card p-5 border border-outline-variant shadow-level-1 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-bold text-primary text-sm">{listing.title}</h3>
                      {isApproved && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">verified</span>
                          Live &amp; Verified
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">cancel</span>
                          Rejected
                        </span>
                      )}
                      {isPending && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">hourglass_top</span>
                          Pending Review
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-on-surface-variant">
                      <p>
                        Owner: <strong className="text-[#333333] font-semibold">{listing.owner?.full_name || 'Landlord'}</strong>
                      </p>
                      <p>
                        Contact: <strong className="text-[#333333] font-semibold">{listing.owner?.phone || listing.owner?.email || 'N/A'}</strong>
                      </p>
                      <p>
                        Location: <strong className="text-[#333333] font-semibold">{listing.location_name}</strong>
                      </p>
                      <p>
                        Rent: <strong className="text-primary font-bold">₹{listing.base_price.toLocaleString('en-IN')}/mo</strong>
                      </p>
                      <p>
                        Type: <span className="font-semibold text-deep-green">{listing.gender_type}</span>
                      </p>
                      <p>
                        Address: <span className="truncate">{listing.address}</span>
                      </p>
                    </div>

                    {listing.rejection_reason && (
                      <div className="mt-1 p-2.5 bg-rose-50/70 border border-rose-200 rounded-lg text-xs text-rose-800">
                        <strong>Rejection Reason:</strong> {listing.rejection_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 self-end lg:self-center shrink-0">
                    <Link
                      href={`/listings/${listing.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 border border-[#B8D9B0] bg-white hover:bg-surface-container-low text-primary rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      Inspect Listing
                    </Link>

                    {isPending && (
                      <>
                        <button
                          onClick={() => {
                            setRejectingItem({
                              type: 'listing',
                              id: listing.id,
                              title: listing.title,
                              targetUserId: listing.owner_id,
                            });
                            setRejectionReasonInput('');
                          }}
                          className="px-3.5 py-2 border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveListing(listing)}
                          disabled={processingId === listing.id}
                          className="px-4 py-2 bg-deep-green hover:bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {processingId === listing.id && (
                            <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                          )}
                          Approve &amp; Publish
                        </button>
                      </>
                    )}

                    {!isPending && (
                      <button
                        onClick={() => {
                          setRejectingItem({
                            type: 'listing',
                            id: listing.id,
                            title: listing.title,
                            targetUserId: listing.owner_id,
                          });
                          setRejectionReasonInput(listing.rejection_reason || '');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-rose-700 hover:underline cursor-pointer"
                      >
                        Change Status
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-card p-12 text-center flex flex-col items-center justify-center gap-3 border border-outline-variant shadow-level-1">
              <span className="material-symbols-outlined text-5xl text-outline-variant">apartment</span>
              <p className="text-sm font-bold text-primary">No property listings match the selected filter.</p>
              <p className="text-xs text-on-surface-variant">
                Newly registered accommodations by property owners will be queued here for verification.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── Rejection Reason Modal ─── */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-card p-6 border border-outline-variant shadow-level-2 max-w-lg w-full flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="text-base font-bold text-rose-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600">gavel</span>
                Reject {rejectingItem.type === 'student' ? 'Student Verification' : 'Property Listing'}
              </h3>
              <button
                onClick={() => setRejectingItem(null)}
                className="text-on-surface-variant hover:text-primary cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Specify the reason for rejecting <strong className="text-primary">{rejectingItem.title}</strong>.
              This feedback will be stored authoritatively and transmitted to the user via notification.
            </p>

            {/* Quick reason suggestions */}
            <div className="flex flex-wrap gap-1.5">
              {(rejectingItem.type === 'student'
                ? [
                    'Document is blurry or unreadable',
                    'Name does not match student profile',
                    'Expired or invalid college ID',
                    'Aadhaar / College ID not clearly visible',
                  ]
                : [
                    'Physical address is inaccurate or unverifiable',
                    'Room pricing details are misleading',
                    'Inadequate or low-quality property photos',
                    'Missing mandatory fire NOC / safety certificates',
                  ]
              ).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRejectionReasonInput(preset)}
                  className="text-[11px] bg-surface-container-low hover:bg-light-sage/40 text-primary px-2.5 py-1 rounded-md border border-outline-variant/60 cursor-pointer transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmitRejection} className="flex flex-col gap-3">
              <textarea
                required
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Enter detailed feedback for the user..."
                className="w-full p-3 border border-[#B8D9B0] rounded-lg text-xs text-primary focus:border-primary outline-none resize-none"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  disabled={isSubmittingRejection}
                  className="px-4 py-2 border border-outline-variant text-on-surface-variant hover:bg-surface-container-low rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRejection || !rejectionReasonInput.trim()}
                  className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingRejection && (
                    <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  )}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
