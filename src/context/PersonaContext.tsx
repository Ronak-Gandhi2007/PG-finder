'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Database, UserRole as DbUserRole } from '@/types/database';

export type UserRole = 'GUEST' | 'STUDENT' | 'OWNER' | 'ADMIN';
export type Profile = Database['public']['Tables']['profiles']['Row'];

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
}

export interface Listing {
  id: string;
  title: string;
  location: string;
  price: number;
  rating: number;
  reviewsCount: number;
  image: string;
  images: string[];
  distanceText: string;
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
  type: 'Boys' | 'Girls' | 'Co-ed';
  premium: boolean;
  amenities: string[];
  rooms: { name: string; price: number; available: boolean }[];
  ownerId?: string;
  owner: { name: string; phone: string; email: string; avatar: string };
  description: string;
  reviews: Review[];
  verified: boolean;
}

export interface Booking {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  date: string;
  timeSlot: string;
  status: 'Pending' | 'Confirmed' | 'Declined' | 'Rescheduled' | 'Completed' | 'Cancelled';
  ownerName: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
}

export interface VerificationItem {
  id: string;
  ownerName: string;
  listingTitle: string;
  documentType: string;
  documentName: string;
  submissionDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface ReportItem {
  id: string;
  reporterName: string;
  targetType: 'Listing' | 'Review';
  targetName: string;
  reason: string;
  date: string;
  status: 'Open' | 'Resolved' | 'Dismissed';
}

interface PersonaContextType {
  // Authoritative Authentication State
  user: User | null;
  profile: Profile | null;
  role: UserRole;
  setRole: (role: UserRole) => void;
  isAdminAuthorized: boolean;
  setIsAdminAuthorized: (authorized: boolean) => void;
  isLoadingAuth: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  requestRoleChange: (role: UserRole) => void;
  requireAuth: () => void;

  // Existing Mock Data State (preserved for listings, search, bookings)
  listings: Listing[];
  setListings: React.Dispatch<React.SetStateAction<Listing[]>>;
  shortlist: string[];
  toggleShortlist: (id: string) => void;
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, 'id' | 'status'>) => Promise<{ error?: string; success?: boolean } | void> | void;
  updateBookingStatus: (id: string, status: Booking['status']) => Promise<void> | void;
  verificationPipeline: VerificationItem[];
  updateVerificationStatus: (id: string, status: VerificationItem['status']) => void;
  reports: ReportItem[];
  updateReportStatus: (id: string, status: ReportItem['status']) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  priceRange: string;
  setPriceRange: (range: string) => void;
}

const initialListings: Listing[] = [
  {
    id: 'listing-1',
    title: 'Green Leaf Residences',
    location: 'North Campus Area',
    price: 8500,
    rating: 4.5,
    reviewsCount: 24,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAm8lPh-Mh5caZDv8otgb_zbadZcAdDju396GSImXWmGWluVmY84Ux_xLoF2VC-lYMdHWMG7FUq-Gc0MuQ2j9d3i5fuRXHrsmha7p_8co2PX0ntqHVv6_Br2Nk3Nze04cTAl_RZnhWqnSwPN9FXk0Xo28PH3UowicNa3OeV-QyOCj-HpXLTxT6pajpTJ52a6nxk81CjYC-nxto-OsTinCozpc9oPhYTwyCf0sebvQNOHzVcEb-PhLVG',
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAm8lPh-Mh5caZDv8otgb_zbadZcAdDju396GSImXWmGWluVmY84Ux_xLoF2VC-lYMdHWMG7FUq-Gc0MuQ2j9d3i5fuRXHrsmha7p_8co2PX0ntqHVv6_Br2Nk3Nze04cTAl_RZnhWqnSwPN9FXk0Xo28PH3UowicNa3OeV-QyOCj-HpXLTxT6pajpTJ52a6nxk81CjYC-nxto-OsTinCozpc9oPhYTwyCf0sebvQNOHzVcEb-PhLVG',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBww10ZNK22CqL1MKpLilSEPmeFJIVw9ezy4Hz5PIQ0v7iZKKUwKVd-JwHNJ7L1vERXYod-a6gima6xDCefXNwYoZzKUK3BgdkxR2jP53nBvoPK9gBJvC8BKzDGVo9yPrryFW1gSp8YGrTkkxLVbGdsfvhhcp8SjNvU-ZuvwbX6gZZCdzli0QPqzFzGeppIWthUYjqlrJEEzN_We4gkkt8ttCe1FV8Jvh7UhEWK7UPI2UT0nooWRwDE',
    ],
    distanceText: '5 mins walk to college',
    type: 'Boys',
    premium: false,
    verified: true,
    amenities: ['Wifi', 'AC', 'Power Backup', 'Food Included', 'CCTV', 'Security'],
    rooms: [
      { name: 'Single Room', price: 12000, available: true },
      { name: 'Double Sharing', price: 8500, available: true },
      { name: 'Triple Sharing', price: 6500, available: false },
    ],
    owner: {
      name: 'Ramesh Kumar',
      phone: '+91 98765 43210',
      email: 'ramesh@pgfinder.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
    },
    description: 'Green Leaf Residences offers premium student living with a modern minimal style in the quietest pocket of the North Campus area. Ideal for students who prioritize peace of mind, high-speed internet, and home-style nutritious food. Daily laundry services and 24/7 security are included.',
    reviews: [
      { id: 'r1', author: 'Aman Sharma', rating: 5, date: '2026-08-01', comment: 'Very clean rooms and nice food. Ramesh Uncle is very helpful.' },
      { id: 'r2', author: 'Vikram Singh', rating: 4, date: '2026-07-28', comment: 'Excellent high-speed Wi-Fi, perfect for study. Quiet environment.' },
    ],
  },
  {
    id: 'listing-2',
    title: "The Scholar's Abode",
    location: 'South Ext. Zone',
    price: 12000,
    rating: 4.8,
    reviewsCount: 42,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5pCTp3k1FCq-3XHGKV2oHeHVb_nLeF_SRifbW1gBGQf1IZsbzXAtLlT1oezipOlG2E1C-Lbxz0u0OtnOFYnghKi85o7hNPV1TwW2CLmY78QjC2EZR4oYFpDI0v6pmhWGQJzBbZNjyhXVaOKzIfif84mndDETJUI8S_C4-P3_eYwPZHbuVYKvq6m334Dy4d5NSKcWCdz1AQHHE1eLuv34s3JklKR_hYO-rWjmvhaBcpvh9GmyeRmYs',
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC5pCTp3k1FCq-3XHGKV2oHeHVb_nLeF_SRifbW1gBGQf1IZsbzXAtLlT1oezipOlG2E1C-Lbxz0u0OtnOFYnghKi85o7hNPV1TwW2CLmY78QjC2EZR4oYFpDI0v6pmhWGQJzBbZNjyhXVaOKzIfif84mndDETJUI8S_C4-P3_eYwPZHbuVYKvq6m334Dy4d5NSKcWCdz1AQHHE1eLuv34s3JklKR_hYO-rWjmvhaBcpvh9GmyeRmYs',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD_4ybjU8pDatqwKDFx7yva0oyA8eEKSKVdYNvbkXDSa1eUFNIGSANy90ZGVdumrxBDn55S4wcAUmYWWG7vUMk-O-h4ZnsSXfrCAPzpYw5GRGQr4YNBz9fX4lqfMuh-d9ijYnf1yqIg8qtZH-SV5b2vSydtxKABuBeXQakcn4p4Z7871PSbdTERPy6KuZ_xOjEoUxQkQrQbmNQPk_i4CJ9QNutMfcNy68Y5l8AA6XVs5J34TyceWBrR',
    ],
    distanceText: '15 mins bus ride to college',
    type: 'Girls',
    premium: true,
    verified: true,
    amenities: ['Wifi', 'AC', 'Gym', 'Laundry', 'Food Included', 'CCTV', 'Biometric Entry', 'Peacful Study Room'],
    rooms: [
      { name: 'Single Suite', price: 18000, available: true },
      { name: 'Twin Room', price: 12000, available: true },
    ],
    owner: {
      name: 'Sunita Sharma',
      phone: '+91 99999 88888',
      email: 'sunita@scholarsabode.com',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
    },
    description: 'An elite hostel living experience exclusively for female students. Located in the highly secure South Ext. Zone, featuring biometric entry, modern security, an in-house gymnasium, and a dedicated library room. Our goal is to provide a home away from home with premium comforts.',
    reviews: [
      { id: 'r3', author: 'Neha Gupta', rating: 5, date: '2026-08-04', comment: 'Extremely safe and beautiful. Best accommodation I have ever stayed in.' },
      { id: 'r4', author: 'Pooja Roy', rating: 4.5, date: '2026-07-15', comment: 'The gym is very well equipped and food is delicious.' },
    ],
  },
  {
    id: 'listing-3',
    title: 'Harmony House',
    location: 'Tech Park Road',
    price: 6000,
    rating: 4.2,
    reviewsCount: 18,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD4hh1JlQ4KvtIzEejGlq2kDX8wyYd07ileen21WMo05pUVbgXr82GC0qxNgJgwEcVNV9zvGpdCFlxdqBWM9sjz3EQsbC4V_JyJPpR7IaNcQRD4aWU4IkAn0TsIKQsd1QG6Asx70RVi5865nAajbIxkjK6rgKNDjekuae8fohn0AMydAJR3wTdQA476d4dzl-pkl1XDCOV3VBevwnTZmlqY38catB9sxOq7MhcwBznkiCK8aFPM0eRA',
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD4hh1JlQ4KvtIzEejGlq2kDX8wyYd07ileen21WMo05pUVbgXr82GC0qxNgJgwEcVNV9zvGpdCFlxdqBWM9sjz3EQsbC4V_JyJPpR7IaNcQRD4aWU4IkAn0TsIKQsd1QG6Asx70RVi5865nAajbIxkjK6rgKNDjekuae8fohn0AMydAJR3wTdQA476d4dzl-pkl1XDCOV3VBevwnTZmlqY38catB9sxOq7MhcwBznkiCK8aFPM0eRA',
    ],
    distanceText: '10 mins walk to college',
    type: 'Co-ed',
    premium: false,
    verified: true,
    amenities: ['Wifi', 'Power Backup', 'Food Included', 'Laundry', 'CCTV'],
    rooms: [
      { name: 'Double Sharing', price: 7500, available: true },
      { name: 'Triple Sharing', price: 6000, available: true },
    ],
    owner: {
      name: 'Anil Gupta',
      phone: '+91 91234 56789',
      email: 'anil@harmonyhouse.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    },
    description: 'Harmony House offers friendly, budget-friendly and community-centered living. Located close to Tech Park Road, it offers twin and triple sharing rooms. Commencing meals, recreation rooms, and cooperative student environment.',
    reviews: [
      { id: 'r5', author: 'Rahul Sen', rating: 4, date: '2026-08-05', comment: 'Very cheap and good. Location is perfect for tech campus.' },
    ],
  },
];

const initialBookings: Booking[] = [
  {
    id: 'booking-1',
    listingId: 'listing-1',
    listingTitle: 'Green Leaf Residences',
    listingImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAm8lPh-Mh5caZDv8otgb_zbadZcAdDju396GSImXWmGWluVmY84Ux_xLoF2VC-lYMdHWMG7FUq-Gc0MuQ2j9d3i5fuRXHrsmha7p_8co2PX0ntqHVv6_Br2Nk3Nze04cTAl_RZnhWqnSwPN9FXk0Xo28PH3UowicNa3OeV-QyOCj-HpXLTxT6pajpTJ52a6nxk81CjYC-nxto-OsTinCozpc9oPhYTwyCf0sebvQNOHzVcEb-PhLVG',
    date: '2026-08-12',
    timeSlot: '11:00 AM - 12:00 PM',
    status: 'Confirmed',
    ownerName: 'Ramesh Kumar',
    studentName: 'Aarav Malhotra',
    studentEmail: 'aarav@student.in',
    studentPhone: '+91 98989 89898',
  },
  {
    id: 'booking-2',
    listingId: 'listing-2',
    listingTitle: "The Scholar's Abode",
    listingImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5pCTp3k1FCq-3XHGKV2oHeHVb_nLeF_SRifbW1gBGQf1IZsbzXAtLlT1oezipOlG2E1C-Lbxz0u0OtnOFYnghKi85o7hNPV1TwW2CLmY78QjC2EZR4oYFpDI0v6pmhWGQJzBbZNjyhXVaOKzIfif84mndDETJUI8S_C4-P3_eYwPZHbuVYKvq6m334Dy4d5NSKcWCdz1AQHHE1eLuv34s3JklKR_hYO-rWjmvhaBcpvh9GmyeRmYs',
    date: '2026-08-15',
    timeSlot: '04:00 PM - 05:00 PM',
    status: 'Pending',
    ownerName: 'Sunita Sharma',
    studentName: 'Aarav Malhotra',
    studentEmail: 'aarav@student.in',
    studentPhone: '+91 98989 89898',
  },
];

const initialVerificationPipeline: VerificationItem[] = [
  {
    id: 'verify-1',
    ownerName: 'Anil Gupta',
    listingTitle: 'Harmony House',
    documentType: 'LandRegistry & Fire NOC',
    documentName: 'harmony_deeds_fire_safety.pdf',
    submissionDate: '2026-08-08',
    status: 'Pending',
  },
  {
    id: 'verify-2',
    ownerName: 'Ramesh Kumar',
    listingTitle: 'Green Leaf Residences',
    documentType: 'Aadhaar ID & Utility Bill',
    documentName: 'ramesh_id_utility.pdf',
    submissionDate: '2026-08-03',
    status: 'Approved',
  },
];

const initialReports: ReportItem[] = [
  {
    id: 'report-1',
    reporterName: 'Divya K.',
    targetType: 'Review',
    targetName: 'Review by Rahul Sen on Harmony House',
    reason: 'Offensive language used in thread.',
    date: '2026-08-07',
    status: 'Open',
  },
  {
    id: 'report-2',
    reporterName: 'Admin Bot',
    targetType: 'Listing',
    targetName: "The Scholar's Abode",
    reason: 'Duplicate listing flagged in same area.',
    date: '2026-08-06',
    status: 'Dismissed',
  },
];

import { AuthModal } from '@/components/AuthModal';

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export const PersonaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRoleState] = useState<UserRole>('GUEST');
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authPendingRole, setAuthPendingRole] = useState<UserRole | null>(null);

  const isPlaceholderMode =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.includes('placeholder');

  const isDevDemo = process.env.NODE_ENV === 'development' && isPlaceholderMode;

  // Listing, booking, and search states
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [shortlist, setShortlist] = useState<string[]>(() => (isDevDemo ? ['listing-2'] : []));
  const [bookings, setBookings] = useState<Booking[]>(() => (isDevDemo ? initialBookings : []));
  const [verificationPipeline, setVerificationPipeline] = useState<VerificationItem[]>(initialVerificationPipeline);
  const [reports, setReports] = useState<ReportItem[]>(initialReports);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState('');

  // Authoritatively fetch user's profile from Supabase public.profiles
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile row is not yet provisioned by the trigger, retry once or fallback to STUDENT
        console.warn('Profile fetch note:', error.message);
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.error('Error fetching authoritative profile:', err);
      return null;
    }
  }, [supabase]);

  // Refresh profile action available to context consumers (e.g. after updating settings)
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    if (p) {
      setProfile(p);
      setRoleState(p.role as UserRole);
      setIsAdminAuthorized(p.role === 'ADMIN');
    }
  }, [user, fetchProfile]);

  // Fetch user's shortlist from Supabase public.shortlists
  const fetchShortlist = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('shortlists')
        .select('property_id')
        .eq('student_id', userId);

      if (error) {
        console.error('Error loading shortlist from Supabase:', error.message);
        return;
      }
      if (data) {
        setShortlist(data.map((row) => row.property_id));
      }
    } catch (err) {
      console.error('Exception loading shortlist:', err);
    }
  }, [supabase]);

// Reusable booking row mapper
function mapBookingRow(row: any, ownerNameFallback = ''): Booking {
  let primaryImg = '';
  const images = row.properties?.property_images;
  if (Array.isArray(images) && images.length > 0) {
    const primary = images.find((img: any) => img.is_primary);
    if (primary?.image_url) {
      primaryImg = primary.image_url;
    } else {
      const sorted = [...images].sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
      primaryImg = sorted[0]?.image_url || '';
    }
  }

  return {
    id: row.id,
    listingId: row.property_id,
    listingTitle: row.properties?.title || '',
    listingImage: primaryImg,
    date: row.visit_date,
    timeSlot: row.time_slot,
    status: row.status as Booking['status'],
    ownerName: ownerNameFallback,
    studentName: row.student_name || '',
    studentEmail: row.student_email || '',
    studentPhone: row.student_phone || '',
  };
}

  // Fetch real student or owner bookings from Supabase public.bookings_visits
  const fetchUserBookings = useCallback(async (userId: string, userRole: UserRole, ownerFullName = '') => {
    try {
      let query = supabase
        .from('bookings_visits')
        .select(`
          id,
          property_id,
          visit_date,
          time_slot,
          status,
          student_name,
          student_email,
          student_phone,
          properties (
            title,
            property_images (
              image_url,
              is_primary,
              display_order
            )
          )
        `);

      if (userRole === 'STUDENT') {
        query = query.eq('student_id', userId);
      } else if (userRole === 'OWNER') {
        query = query.eq('owner_id', userId);
      } else {
        return;
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading bookings from Supabase:', error.message);
        return;
      }

      if (data) {
        const mappedBookings: Booking[] = data.map((row: any) =>
          mapBookingRow(row, userRole === 'OWNER' ? ownerFullName : '')
        );
        setBookings(mappedBookings);
      }
    } catch (err) {
      console.error('Exception loading bookings:', err);
    }
  }, [supabase]);

  // Initial Auth Lifecycle & Realtime Session Listener via Supabase Auth
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (currentUser) {
          setUser(currentUser);
          // Real authenticated user: do not keep mock bookings or mock shortlist
          setBookings((prev) => (prev === initialBookings ? [] : prev.filter((b) => b.id !== 'booking-1' && b.id !== 'booking-2')));
          if (!isDevDemo) {
            await fetchShortlist(currentUser.id);
          } else {
            setShortlist((prev) => (prev.length === 1 && prev[0] === 'listing-2' ? [] : prev.filter((id) => id !== 'listing-2')));
          }
          const p = await fetchProfile(currentUser.id);
          if (isMounted) {
            if (p) {
              setProfile(p);
              setRoleState(p.role as UserRole);
              setIsAdminAuthorized(p.role === 'ADMIN');
              if (!isDevDemo) {
                if (p.role === 'STUDENT' || p.role === 'OWNER') {
                  await fetchUserBookings(currentUser.id, p.role as UserRole, p.full_name || '');
                }
              }
            } else {
              setProfile(null);
              setRoleState('GUEST');
              setIsAdminAuthorized(false);
            }
          }
        } else {
          // If no authenticated user exists, clear session state to GUEST
          setUser(null);
          setProfile(null);
          setRoleState('GUEST');
          setIsAdminAuthorized(false);
          setBookings([]);
          setShortlist([]);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (isMounted) {
          setUser(null);
          setProfile(null);
          setRoleState('GUEST');
          setIsAdminAuthorized(false);
          if (!isDevDemo) {
            setBookings([]);
            setShortlist([]);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingAuth(false);
        }
      }
    }

    initSession();

    // Subscribe to auth state changes (SIGN_IN, SIGN_OUT, TOKEN_REFRESHED)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setProfile(null);
        setRoleState('GUEST');
        setIsAdminAuthorized(false);
        setIsLoadingAuth(false);
        setBookings([]);
        setShortlist([]);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setUser(session.user);
        // Real authenticated user: do not keep mock bookings or mock shortlist
        setBookings((prev) => (prev === initialBookings ? [] : prev.filter((b) => b.id !== 'booking-1' && b.id !== 'booking-2')));
        if (!isDevDemo) {
          await fetchShortlist(session.user.id);
        }
        const p = await fetchProfile(session.user.id);
        if (isMounted) {
          if (p) {
            setProfile(p);
            setRoleState(p.role as UserRole);
            setIsAdminAuthorized(p.role === 'ADMIN');
            if (!isDevDemo) {
              if (p.role === 'STUDENT' || p.role === 'OWNER') {
                await fetchUserBookings(session.user.id, p.role as UserRole, p.full_name || '');
              }
            }
          } else {
            setProfile(null);
            setRoleState('GUEST');
            setIsAdminAuthorized(false);
          }
          setIsLoadingAuth(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile, fetchShortlist, fetchUserBookings, isDevDemo]);

  // Backward compatible setRole handler
  const handleSetRole = (newRole: UserRole) => {
    // If a real Supabase session exists, setRole is a no-op
    if (user) {
      return;
    }
    // Only allow changing persona in dev-only demo mode
    if (!isDevDemo) {
      return;
    }
    setRoleState(newRole);
    if (newRole === 'ADMIN') {
      setIsAdminAuthorized(true);
    } else {
      setIsAdminAuthorized(false);
    }
    setAuthPendingRole(null);
  };

  const handleSetIsAdminAuthorized = (authorized: boolean) => {
    if (user) {
      // For a real signed-in user, isAdminAuthorized must never become true unless profile.role === 'ADMIN'
      setIsAdminAuthorized(profile?.role === 'ADMIN');
      return;
    }
    if (isDevDemo) {
      setIsAdminAuthorized(authorized);
    }
  };

  // Authoritative Supabase Sign Out
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setRoleState('GUEST');
      setIsAdminAuthorized(false);
      setAuthPendingRole(null);
      if (isDevDemo) {
        setBookings(initialBookings);
        setShortlist(['listing-2']);
      } else {
        setBookings([]);
        setShortlist([]);
      }
    }
  };

  const requestRoleChange = (newRole: UserRole) => {
    if (user || !isDevDemo) {
      return;
    }
    if (newRole === 'GUEST') {
      handleSetRole(newRole);
    } else {
      setAuthPendingRole(newRole);
    }
  };

  const requireAuth = () => {
    if (role === 'GUEST') {
      setAuthPendingRole('STUDENT');
    }
  };

  const toggleShortlist = async (id: string) => {
    // Dev-only demo mode keeps its current in-memory behavior
    if (isDevDemo) {
      setShortlist((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
      return;
    }

    // For guests keep whatever happens today
    if (!user) {
      setShortlist((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
      return;
    }

    // If the signed-in role is OWNER or ADMIN, do nothing (no write) and keep the heart unchanged
    const userRole = profile?.role;
    if (userRole === 'OWNER' || userRole === 'ADMIN') {
      return;
    }

    // Real signed-in STUDENT: update state optimistically, then INSERT or DELETE
    const isCurrentlyShortlisted = shortlist.includes(id);

    if (isCurrentlyShortlisted) {
      // Optimistic delete
      setShortlist((prev) => prev.filter((item) => item !== id));

      try {
        const { error } = await supabase
          .from('shortlists')
          .delete()
          .eq('student_id', user.id)
          .eq('property_id', id);

        if (error) {
          console.error('Failed to remove property from shortlist in Supabase:', error);
          // Revert optimistic change
          setShortlist((prev) => (prev.includes(id) ? prev : [...prev, id]));
        }
      } catch (err) {
        console.error('Exception removing property from shortlist:', err);
        // Revert optimistic change
        setShortlist((prev) => (prev.includes(id) ? prev : [...prev, id]));
      }
    } else {
      // Optimistic insert
      setShortlist((prev) => (prev.includes(id) ? prev : [...prev, id]));

      try {
        // Never send a role or any other field from the client
        const { error } = await supabase
          .from('shortlists')
          .insert({
            student_id: user.id,
            property_id: id,
          });

        if (error) {
          console.error('Failed to add property to shortlist in Supabase:', error);
          // Revert optimistic change
          setShortlist((prev) => prev.filter((item) => item !== id));
        }
      } catch (err) {
        console.error('Exception adding property to shortlist:', err);
        // Revert optimistic change
        setShortlist((prev) => prev.filter((item) => item !== id));
      }
    }
  };

  const addBooking = async (newBooking: Omit<Booking, 'id' | 'status'>): Promise<{ error?: string; success?: boolean } | void> => {
    if (isDevDemo) {
      const id = `booking-${Date.now()}`;
      const booking: Booking = {
        ...newBooking,
        id,
        status: 'Pending',
      };
      setBookings((prev) => [booking, ...prev]);
      return { success: true };
    }

    if (!user) {
      return { error: 'Please sign in to schedule a visit.' };
    }

    const currentRole = profile?.role || role;
    if (currentRole === 'OWNER' || currentRole === 'ADMIN') {
      // Owners and admins: addBooking does nothing
      return;
    }

    try {
      const phoneToInsert = newBooking.studentPhone?.trim() || profile?.phone?.trim() || null;
      const { data, error } = await supabase
        .from('bookings_visits')
        .insert({
          student_id: user.id,
          property_id: newBooking.listingId,
          visit_date: newBooking.date,
          time_slot: newBooking.timeSlot,
          student_phone: phoneToInsert,
        } as any)
        .select(`
          id,
          property_id,
          visit_date,
          time_slot,
          status,
          student_name,
          student_email,
          student_phone,
          properties (
            title,
            property_images (
              image_url,
              is_primary,
              display_order
            )
          )
        `)
        .single();

      if (error) {
        console.error('Failed to create booking in Supabase:', error);
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('uq_booking_active_slot')) {
          return { error: 'You already requested this slot' };
        }
        return { error: error.message || 'Failed to schedule visit. Please try again.' };
      }

      if (data) {
        const createdBooking = mapBookingRow(data);
        if (newBooking.listingTitle && !createdBooking.listingTitle) {
          createdBooking.listingTitle = newBooking.listingTitle;
        }
        if (newBooking.listingImage && !createdBooking.listingImage) {
          createdBooking.listingImage = newBooking.listingImage;
        }
        setBookings((prev) => [createdBooking, ...prev]);
        return { success: true };
      }
    } catch (err: any) {
      console.error('Exception creating booking:', err);
      return { error: err?.message || 'An unexpected error occurred.' };
    }
  };

  const updateBookingStatus = async (id: string, status: Booking['status']) => {
    const currentRole = profile?.role || role;

    if (!isDevDemo && user && (currentRole === 'STUDENT' || currentRole === 'OWNER')) {
      if (currentRole === 'STUDENT') {
        if (status !== 'Cancelled') {
          console.warn('Students may only cancel bookings.');
          return;
        }
      } else if (currentRole === 'OWNER') {
        if (status !== 'Confirmed' && status !== 'Declined') {
          console.warn('Owners may only confirm or decline bookings.');
          return;
        }
      }

      const target = bookings.find((b) => b.id === id);
      if (!target) return;
      const oldStatus = target.status;

      // Optimistic update
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b))
      );

      try {
        const { data, error } = await supabase
          .from('bookings_visits')
          .update({ status })
          .eq('id', id)
          .select('id');

        if (error || !data || data.length === 0) {
          console.error('Failed to update booking in Supabase or zero rows updated:', error?.message || 'Zero rows updated');
          // Revert optimistic update
          setBookings((prev) =>
            prev.map((b) => (b.id === id ? { ...b, status: oldStatus } : b))
          );
        }
      } catch (err) {
        console.error('Exception updating booking in Supabase:', err);
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: oldStatus } : b))
        );
      }
      return;
    }

    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status } : b))
    );
  };

  const updateVerificationStatus = (id: string, status: VerificationItem['status']) => {
    setVerificationPipeline((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
    if (status === 'Approved') {
      setVerificationPipeline((prevPipeline) => {
        const item = prevPipeline.find((p) => p.id === id);
        if (item) {
          setListings((prevListings) =>
            prevListings.map((l) =>
              l.title === item.listingTitle ? { ...l, verified: true } : l
            )
          );
        }
        return prevPipeline;
      });
    }
  };

  const updateReportStatus = (id: string, status: ReportItem['status']) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  return (
    <PersonaContext.Provider
      value={{
        user,
        profile,
        role: user ? ((profile?.role as UserRole) || 'GUEST') : role,
        setRole: handleSetRole,
        isAdminAuthorized: user ? profile?.role === 'ADMIN' : (isDevDemo ? isAdminAuthorized : false),
        setIsAdminAuthorized: handleSetIsAdminAuthorized,
        isLoadingAuth,
        logout,
        refreshProfile,
        requestRoleChange,
        requireAuth,
        listings,
        setListings,
        shortlist,
        toggleShortlist,
        bookings,
        addBooking,
        updateBookingStatus,
        verificationPipeline,
        updateVerificationStatus,
        reports,
        updateReportStatus,
        searchQuery,
        setSearchQuery,
        priceRange,
        setPriceRange,
      }}
    >
      {authPendingRole && (
        <AuthModal 
          targetRole={authPendingRole} 
          onSuccess={handleSetRole} 
          onCancel={() => setAuthPendingRole(null)} 
        />
      )}
      {children}
    </PersonaContext.Provider>
  );
};

export const usePersona = () => {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return context;
};
