'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function AdminOverview() {
  const supabase = createClient();

  const [totalListings, setTotalListings] = useState(0);
  const [verifiedListings, setVerifiedListings] = useState(0);
  const [pendingBacklog, setPendingBacklog] = useState(0);
  const [openReports, setOpenReports] = useState(0);
  const [recentActivities, setRecentActivities] = useState<
    { id: string; text: string; time: string; link?: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      setIsLoading(true);
      try {
        // 1. Total Properties
        const { count: totalPropsCount } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true });

        // 2. Verified Properties
        const { count: verifiedPropsCount } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('is_verified', true);

        // 3. Pending Listings (unverified, no rejection reason)
        const { count: pendingPropsCount } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('is_verified', false)
          .is('rejection_reason', null);

        // 4. Pending Student IDs (has doc, unverified, no rejection reason)
        const { count: pendingStudentsCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'STUDENT')
          .not('student_id_doc_url', 'is', null)
          .eq('is_verified', false)
          .is('student_id_rejection_reason', null);

        // 5. Open Reports
        const { count: openRepCount } = await supabase
          .from('reports_flags')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Open');

        setTotalListings(totalPropsCount || 0);
        setVerifiedListings(verifiedPropsCount || 0);
        setPendingBacklog((pendingPropsCount || 0) + (pendingStudentsCount || 0));
        setOpenReports(openRepCount || 0);

        // 6. Recent Platform Activity
        const { data: recentProps } = await supabase
          .from('properties')
          .select('id, title, created_at, is_verified')
          .order('created_at', { ascending: false })
          .limit(3);

        const { data: recentDocs } = await supabase
          .from('profiles')
          .select('id, full_name, updated_at, is_verified, student_id_doc_url')
          .eq('role', 'STUDENT')
          .not('student_id_doc_url', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(3);

        const activities: { id: string; text: string; time: string; link?: string; timestamp: number }[] = [];

        (recentProps || []).forEach((p) => {
          activities.push({
            id: `prop-${p.id}`,
            text: `Listing ${p.is_verified ? 'verified' : 'registered'}: "${p.title}"`,
            time: new Date(p.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
            link: '/dashboard/admin/verification',
            timestamp: new Date(p.created_at).getTime(),
          });
        });

        (recentDocs || []).forEach((d) => {
          activities.push({
            id: `student-${d.id}`,
            text: `Student ${d.full_name} ${d.is_verified ? 'verified' : 'submitted ID proof'}`,
            time: new Date(d.updated_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
            link: '/dashboard/admin/verification',
            timestamp: new Date(d.updated_at).getTime(),
          });
        });

        activities.sort((a, b) => b.timestamp - a.timestamp);
        setRecentActivities(activities.slice(0, 5));
      } catch (err) {
        console.error('Error loading admin overview metrics:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMetrics();
  }, [supabase]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant">
        <h1 className="text-xl font-bold text-primary">Admin System Control Overview</h1>
        <p className="text-xs text-on-surface-variant mt-1">
          Real-time metrics, verification backlog, and platform activity powered by authoritative database state.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-level-1 flex flex-col gap-1">
          <span className="text-xs text-on-surface-variant font-medium">Total Listings</span>
          <span className="text-2xl font-bold text-primary">
            {isLoading ? '…' : totalListings}
          </span>
        </div>
        <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-level-1 flex flex-col gap-1">
          <span className="text-xs text-on-surface-variant font-medium">Verified PGs</span>
          <span className="text-2xl font-bold text-emerald-700">
            {isLoading ? '…' : verifiedListings}
          </span>
        </div>
        <Link
          href="/dashboard/admin/verification"
          className="bg-white border border-outline-variant hover:border-primary/50 p-4 rounded-xl shadow-level-1 flex flex-col gap-1 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium">Verification Backlog</span>
            <span className="material-symbols-outlined text-[16px] text-primary">arrow_forward</span>
          </div>
          <span className="text-2xl font-bold text-amber-700">
            {isLoading ? '…' : pendingBacklog}
          </span>
        </Link>
        <Link
          href="/dashboard/admin/reports"
          className="bg-white border border-outline-variant hover:border-primary/50 p-4 rounded-xl shadow-level-1 flex flex-col gap-1 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium">Open Reports</span>
            <span className="material-symbols-outlined text-[16px] text-primary">arrow_forward</span>
          </div>
          <span className="text-2xl font-bold text-rose-700">
            {isLoading ? '…' : openReports}
          </span>
        </Link>
      </div>

      {/* Platform Activity Logs */}
      <div className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3 mb-4">
          <h2 className="text-sm font-bold text-[#333333]">System Log Activity</h2>
          <Link
            href="/dashboard/admin/verification"
            className="text-xs font-bold text-deep-green hover:underline cursor-pointer"
          >
            Open Verification Portal &rarr;
          </Link>
        </div>

        <div className="flex flex-col gap-3 text-xs text-on-surface-variant">
          {recentActivities.length > 0 ? (
            recentActivities.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between p-2.5 hover:bg-surface-container-low rounded-lg transition-colors border-b border-outline-variant/30"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    notifications
                  </span>
                  <span className="font-semibold text-primary">{act.text}</span>
                </div>
                <span className="text-[11px] text-on-surface-variant shrink-0">{act.time}</span>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-on-surface-variant">
              {isLoading ? 'Loading system activity…' : 'No recent platform events recorded.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
