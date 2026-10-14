'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePersona, Listing } from '@/context/PersonaContext';
import { createClient } from '@/lib/supabase/client';
import LocationPicker from '@/components/LocationPicker';
import { COLLEGE, haversineKm, describeDistance } from '@/lib/geo';

/* ─── Types for real-owner data ─── */
interface DbAmenity {
  id: string;
  name: string;
  icon: string;
}

interface RoomInput {
  name: string;
  price: string;
  totalBeds: string;
}

interface DbPropertyRow {
  id: string;
  title: string;
  location_name: string;
  base_price: number;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  rooms: { id: string }[];
  property_images: { image_url: string; is_primary: boolean; display_order: number }[];
}

interface PhotoRow {
  id: string;
  property_id: string;
  image_url: string;
  caption: string | null;
  display_order: number;
  is_primary: boolean;
}

interface FileUploadStatus {
  name: string;
  state: 'compressing' | 'uploading' | 'saving' | 'done' | 'error';
  error?: string;
}

/* ─── Helpers ─── */
const isPlaceholderMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') ||
  !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.includes('placeholder');

const isDevDemo = process.env.NODE_ENV === 'development' && isPlaceholderMode;

const emptyRoom = (): RoomInput => ({ name: '', price: '', totalBeds: '1' });

function primaryImageUrl(
  images: { image_url: string; is_primary: boolean; display_order: number }[] | null,
): string | null {
  if (!images || images.length === 0) return null;
  const primary = images.find((i) => i.is_primary);
  if (primary) return primary.image_url;
  const sorted = [...images].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  return sorted[0]?.image_url ?? null;
}

/* ================================================================ */
export default function OwnerListings() {
  const { listings, setListings, user, profile } = usePersona();

  const isRealOwner = !!user && !isDevDemo;

  /* ─── Dev-demo branch: use mock context listings ─── */
  const ownerListings = isDevDemo
    ? listings
    : listings.filter(
      (l) => l.id !== 'listing-1' && l.id !== 'listing-2' && l.id !== 'listing-3',
    );

  /* ─── Shared UI state ─── */
  const [showAddForm, setShowAddForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  /* ─── Real-owner DB state ─── */
  const [dbProperties, setDbProperties] = useState<DbPropertyRow[]>([]);
  const [dbAmenities, setDbAmenities] = useState<DbAmenity[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  /* ─── Photo management state ─── */
  const [expandedPhotoProp, setExpandedPhotoProp] = useState<string | null>(null);
  const [propPhotos, setPropPhotos] = useState<Record<string, PhotoRow[]>>({});
  const [photoLoading, setPhotoLoading] = useState<Record<string, boolean>>({});
  const [photoSaving, setPhotoSaving] = useState<Record<string, boolean>>({});
  const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>([]);
  const [photoError, setPhotoError] = useState<Record<string, string>>({});

  /* ─── Form state (shared styling, real-owner-only logic on submit) ─── */
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [locationName, setLocationName] = useState('');
  const [distanceText, setDistanceText] = useState('5 mins walk to college');
  const [genderType, setGenderType] = useState<'Boys' | 'Girls' | 'Co-ed'>('Boys');
  const [basePrice, setBasePrice] = useState('');
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [rooms, setRooms] = useState<RoomInput[]>([emptyRoom()]);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<Set<string>>(new Set());
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [manualPin, setManualPin] = useState(false);
  const [pinStatus, setPinStatus] = useState('');
  const [flySignal, setFlySignal] = useState(0);

  // Distance to the college, calculated from the pin
  const distanceInfo = useMemo(
    () => (pin ? describeDistance(haversineKm(COLLEGE, pin)) : null),
    [pin],
  );

  // Owner clicked or dragged the pin: their choice wins over the address search
  const handleManualPin = useCallback((v: { lat: number; lng: number }) => {
    setPin(v);
    setManualPin(true);
    setPinStatus('Pin set by you. It stays here even if you edit the address.');
  }, []);

  // Auto-search: waits 1 second after the owner stops typing, then places the pin
  useEffect(() => {
    if (!isRealOwner || !showAddForm || manualPin) return;
    const addr = address.trim();
    if (addr.length < 6) return;

    const controller = new AbortController();
    setPinStatus('Searching for this address…');

    const search = async (q: string) => {
      const url =
        'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in' +
        '&accept-language=en&viewbox=73.6,18.75,74.0,18.4&bounded=0&q=' +
        encodeURIComponent(q);
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      return data?.[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
    };

    const timer = setTimeout(async () => {
      try {
        const area = locationName.trim();
        let found = await search(
          [addr, area, 'Pune, Maharashtra, India'].filter(Boolean).join(', '),
        );
        let exact = true;
        if (!found && area) {
          await new Promise((r) => setTimeout(r, 1100)); // free service allows 1 search per second
          found = await search(`${area}, Pune, Maharashtra, India`);
          exact = false;
        }
        if (controller.signal.aborted) return;
        if (found) {
          setPin(found);
          setFlySignal((n) => n + 1);
          setPinStatus(
            exact
              ? 'Pin placed from your address. Drag it or click the map to adjust.'
              : 'Exact address not found, so the pin is on your area. Please drag it to your building.',
          );
        } else {
          setPinStatus('Address not found. Please click the map to place the pin.');
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setPinStatus('Could not search right now. Please click the map to place the pin.');
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [address, locationName, manualPin, isRealOwner, showAddForm]);

  // Dev-demo amenities (kept for backward compat)
  const [demoAmenities, setDemoAmenities] = useState<{ [key: string]: boolean }>({
    Wifi: true,
    AC: false,
    Laundry: false,
    Gym: false,
    'Food Included': true,
    CCTV: false,
    Security: false,
  });

  /* ─── Fetch amenities from DB (real owner) ─── */
  useEffect(() => {
    if (!isRealOwner) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('amenities')
        .select('id, name, icon')
        .order('name');
      if (data) setDbAmenities(data as DbAmenity[]);
    })();
  }, [isRealOwner]);

  /* ─── Fetch owner's properties from DB ─── */
  const fetchProperties = useCallback(async () => {
    if (!isRealOwner || !user) return;
    setLoadingProperties(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('properties')
      .select('id, title, location_name, base_price, is_verified, is_active, created_at, rooms(id), property_images(image_url, is_primary, display_order)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDbProperties(data as unknown as DbPropertyRow[]);
    }
    setLoadingProperties(false);
  }, [isRealOwner, user]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  /* ─── Fetch photos for a single property ─── */
  const fetchPhotos = useCallback(async (propertyId: string) => {
    setPhotoLoading((prev) => ({ ...prev, [propertyId]: true }));
    const supabase = createClient();
    const { data } = await supabase
      .from('property_images')
      .select('id, property_id, image_url, caption, display_order, is_primary')
      .eq('property_id', propertyId)
      .order('display_order', { ascending: true });
    if (data) {
      setPropPhotos((prev) => ({ ...prev, [propertyId]: data as PhotoRow[] }));
    }
    setPhotoLoading((prev) => ({ ...prev, [propertyId]: false }));
  }, []);

  /* ─── Compress image in browser using canvas ─── */
  const compressImage = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX_SIDE = 1600;
        let w = img.width;
        let h = img.height;
        if (w > MAX_SIDE || h > MAX_SIDE) {
          const ratio = Math.min(MAX_SIDE / w, MAX_SIDE / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);

        const tryExport = (type: string, quality: number): Promise<Blob | null> =>
          new Promise((res) => canvas.toBlob((b) => res(b), type, quality));

        (async () => {
          // Try webp first
          let blob = await tryExport('image/webp', 0.8);
          if (!blob || blob.type !== 'image/webp') {
            // Fallback to jpeg
            blob = await tryExport('image/jpeg', 0.8);
          }
          if (blob && blob.size <= 5 * 1024 * 1024) {
            resolve(blob);
            return;
          }
          // Retry with lower quality
          const fallbackType = blob?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
          blob = await tryExport(fallbackType, 0.5);
          if (blob && blob.size <= 5 * 1024 * 1024) {
            resolve(blob);
            return;
          }
          reject(new Error('Image still exceeds 5 MB after compression. Please use a smaller image.'));
        })();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for compression.'));
      };
      img.src = url;
    });
  }, []);

  /* ─── Upload photos handler ─── */
  const handlePhotoUpload = useCallback(async (propertyId: string, files: FileList) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_ORIGINAL = 15 * 1024 * 1024;
    const MAX_PHOTOS = 6;

    const existing = propPhotos[propertyId] || [];
    const remaining = MAX_PHOTOS - existing.length;

    if (remaining <= 0) {
      setPhotoError((prev) => ({ ...prev, [propertyId]: 'This property already has 6 photos (maximum).' }));
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    if (selected.length < files.length) {
      setPhotoError((prev) => ({ ...prev, [propertyId]: `Only ${remaining} more photo(s) allowed. Extra files were skipped.` }));
    } else {
      setPhotoError((prev) => ({ ...prev, [propertyId]: '' }));
    }

    // Validate types and sizes
    for (const f of selected) {
      if (!ALLOWED.includes(f.type)) {
        setPhotoError((prev) => ({
          ...prev,
          [propertyId]: `"${f.name}" is not a supported format. Use JPEG, PNG, or WebP.`,
        }));
        return;
      }
      if (f.size > MAX_ORIGINAL) {
        setPhotoError((prev) => ({
          ...prev,
          [propertyId]: `"${f.name}" exceeds 15 MB. Please choose a smaller file.`,
        }));
        return;
      }
    }

    setPhotoSaving((prev) => ({ ...prev, [propertyId]: true }));
    const statuses: FileUploadStatus[] = selected.map((f) => ({ name: f.name, state: 'compressing' as const }));
    setUploadStatuses(statuses);

    const supabase = createClient();
    let nextOrder = existing.length > 0 ? Math.max(...existing.map((p) => p.display_order)) + 1 : 0;
    const hasPhotos = existing.length > 0;

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      try {
        // Compress
        setUploadStatuses((prev) => prev.map((s, idx) => (idx === i ? { ...s, state: 'compressing' } : s)));
        const compressed = await compressImage(file);

        // Upload
        setUploadStatuses((prev) => prev.map((s, idx) => (idx === i ? { ...s, state: 'uploading' } : s)));
        const ext = compressed.type === 'image/webp' ? 'webp' : 'jpg';
        const storagePath = `${propertyId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('property-images')
          .upload(storagePath, compressed, { contentType: compressed.type, upsert: false });
        if (uploadErr) throw new Error(uploadErr.message);

        // Get public URL
        const { data: urlData } = supabase.storage.from('property-images').getPublicUrl(storagePath);
        const publicUrl = urlData.publicUrl;

        // Insert row
        setUploadStatuses((prev) => prev.map((s, idx) => (idx === i ? { ...s, state: 'saving' } : s)));
        const isPrimary = !hasPhotos && i === 0;
        const { error: rowErr } = await supabase.from('property_images').insert({
          property_id: propertyId,
          image_url: publicUrl,
          display_order: nextOrder,
          is_primary: isPrimary,
        });

        if (rowErr) {
          // Rollback: remove uploaded file
          await supabase.storage.from('property-images').remove([storagePath]);
          throw new Error(rowErr.message);
        }

        nextOrder++;
        setUploadStatuses((prev) => prev.map((s, idx) => (idx === i ? { ...s, state: 'done' } : s)));
      } catch (err: any) {
        setUploadStatuses((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, state: 'error', error: err?.message || 'Upload failed' } : s)),
        );
      }
    }

    await fetchPhotos(propertyId);
    await fetchProperties();
    setPhotoSaving((prev) => ({ ...prev, [propertyId]: false }));
    setTimeout(() => setUploadStatuses([]), 3000);
  }, [propPhotos, compressImage, fetchPhotos, fetchProperties]);

  /* ─── Delete a photo ─── */
  const handleDeletePhoto = useCallback(async (propertyId: string, photo: PhotoRow) => {
    setPhotoSaving((prev) => ({ ...prev, [propertyId]: true }));
    setPhotoError((prev) => ({ ...prev, [propertyId]: '' }));
    const supabase = createClient();

    try {
      // Derive storage path from URL
      const url = new URL(photo.image_url);
      const pathMatch = url.pathname.match(/\/property-images\/(.+)$/);
      const storagePath = pathMatch ? decodeURIComponent(pathMatch[1]) : null;

      // Remove storage object
      if (storagePath) {
        await supabase.storage.from('property-images').remove([storagePath]);
      }

      // Delete the row
      await supabase.from('property_images').delete().eq('id', photo.id);

      // If it was primary, promote the lowest display_order photo
      if (photo.is_primary) {
        const { data: remaining } = await supabase
          .from('property_images')
          .select('id, display_order')
          .eq('property_id', propertyId)
          .order('display_order', { ascending: true })
          .limit(1);
        if (remaining && remaining.length > 0) {
          await supabase
            .from('property_images')
            .update({ is_primary: true })
            .eq('id', remaining[0].id);
        }
      }
    } catch (err: any) {
      setPhotoError((prev) => ({ ...prev, [propertyId]: err?.message || 'Failed to delete photo.' }));
    }

    await fetchPhotos(propertyId);
    await fetchProperties();
    setPhotoSaving((prev) => ({ ...prev, [propertyId]: false }));
  }, [fetchPhotos, fetchProperties]);

  /* ─── Make cover ─── */
  const handleMakeCover = useCallback(async (propertyId: string, photo: PhotoRow) => {
    setPhotoSaving((prev) => ({ ...prev, [propertyId]: true }));
    setPhotoError((prev) => ({ ...prev, [propertyId]: '' }));
    const supabase = createClient();

    try {
      // First, unset the current primary
      await supabase
        .from('property_images')
        .update({ is_primary: false })
        .eq('property_id', propertyId)
        .eq('is_primary', true);

      // Then set the new one
      await supabase
        .from('property_images')
        .update({ is_primary: true })
        .eq('id', photo.id);
    } catch (err: any) {
      setPhotoError((prev) => ({ ...prev, [propertyId]: err?.message || 'Failed to set cover.' }));
    }

    await fetchPhotos(propertyId);
    await fetchProperties();
    setPhotoSaving((prev) => ({ ...prev, [propertyId]: false }));
  }, [fetchPhotos, fetchProperties]);

  /* ─── Toggle photo panel ─── */
  const togglePhotoPanel = useCallback(async (propertyId: string) => {
    if (expandedPhotoProp === propertyId) {
      setExpandedPhotoProp(null);
      return;
    }
    setExpandedPhotoProp(propertyId);
    if (!propPhotos[propertyId]) {
      await fetchPhotos(propertyId);
    }
  }, [expandedPhotoProp, propPhotos, fetchPhotos]);

  /* ─── Room helpers ─── */
  const addRoom = () => {
    if (rooms.length >= 4) return;
    setRooms((prev) => [...prev, emptyRoom()]);
  };
  const removeRoom = (idx: number) => {
    if (rooms.length <= 1) return;
    setRooms((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateRoom = (idx: number, field: keyof RoomInput, value: string) => {
    setRooms((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  /* ─── Amenity toggle (real owner) ─── */
  const toggleAmenity = (id: string) => {
    setSelectedAmenityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ─── Client-side validation (real owner) ─── */
  const validate = (): string | null => {
    if (title.trim().length < 3 || title.trim().length > 100)
      return 'Title must be 3-100 characters.';
    if (!address.trim()) return 'Address is required.';
    if (!locationName.trim()) return 'Area / location name is required.';
    if (pin && haversineKm(COLLEGE, pin) > 50) return `The pin is more than 50 km from ${COLLEGE.name}. Please check the location.`;
    const bp = parseInt(basePrice, 10);
    if (isNaN(bp) || bp < 1 || bp > 100000) return 'Base price must be 1-100000.';
    if (description.trim().length < 20 || description.trim().length > 2000)
      return 'Description must be 20-2000 characters.';
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()))
      return 'Contact email is invalid.';
    if (!pin) return 'Please mark your property location on the map.';
    if (rooms.length < 1 || rooms.length > 4) return 'Add 1-4 room types.';
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (!r.name.trim()) return `Room ${i + 1}: name is required.`;
      const rp = parseInt(r.price, 10);
      if (isNaN(rp) || rp < 1) return `Room ${i + 1}: price must be a positive integer.`;
      const tb = parseInt(r.totalBeds, 10);
      if (isNaN(tb) || tb < 1 || tb > 10) return `Room ${i + 1}: total beds must be 1-10.`;
    }
    return null;
  };

  /* ─── Reset form ─── */
  const resetForm = () => {
    setTitle('');
    setAddress('');
    setLocationName('');
    setDistanceText('5 mins walk to college');
    setGenderType('Boys');
    setBasePrice('');
    setDescription('');
    setContactPhone('');
    setContactEmail('');
    setRooms([emptyRoom()]);
    setSelectedAmenityIds(new Set());
    setPin(null);
    setManualPin(false);
    setPinStatus('');
    setDemoAmenities({ Wifi: true, AC: false, Laundry: false, Gym: false, 'Food Included': true, CCTV: false, Security: false });
  };

  /* ─── Submit: real owner ─── */
  const handleRealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const vErr = validate();
    if (vErr) {
      setErrorMsg(vErr);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    let propertyId: string | null = null;
    const distance = describeDistance(haversineKm(COLLEGE, pin!));

    try {
      // (a) Insert property
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .insert({
          owner_id: user!.id,
          title: title.trim(),
          slug: 'pending',
          description: description.trim(),
          location_name: locationName.trim(),
          address: address.trim(),
          distance_text: distance.text,
          distance_km: distance.km,
          base_price: parseInt(basePrice, 10),
          gender_type: genderType,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
          latitude: pin ? pin.lat : null,
          longitude: pin ? pin.lng : null,
        })
        .select('id')
        .single();

      if (propError) {
        if (propError.code === '53400') {
          setErrorMsg('You can list at most 10 properties.');
        } else {
          setErrorMsg(propError.message || 'Failed to create property.');
        }
        setSaving(false);
        return;
      }

      propertyId = propData.id;

      // (b) Insert rooms
      const roomRows = rooms.map((r) => ({
        property_id: propertyId!,
        name: r.name.trim(),
        price: parseInt(r.price, 10),
        total_beds: parseInt(r.totalBeds, 10),
        available_beds: parseInt(r.totalBeds, 10),
        is_available: true,
      }));

      const { error: roomError } = await supabase.from('rooms').insert(roomRows);

      if (roomError) {
        // Rollback: delete the property (cascade removes rooms)
        await supabase.from('properties').delete().eq('id', propertyId);
        setErrorMsg(roomError.message || 'Failed to add rooms.');
        setSaving(false);
        return;
      }

      // (c) Insert property_amenities
      if (selectedAmenityIds.size > 0) {
        const amenityRows = Array.from(selectedAmenityIds).map((amenityId) => ({
          property_id: propertyId!,
          amenity_id: amenityId,
        }));

        const { error: amenityError } = await supabase
          .from('property_amenities')
          .insert(amenityRows);

        if (amenityError) {
          await supabase.from('properties').delete().eq('id', propertyId);
          setErrorMsg(amenityError.message || 'Failed to save amenities.');
          setSaving(false);
          return;
        }
      }

      // Success
      resetForm();
      setShowAddForm(false);
      setSuccessMsg('Submitted for review. Students will see it once an admin verifies it.');
      await fetchProperties();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      if (propertyId) {
        const supabase2 = createClient();
        await supabase2.from('properties').delete().eq('id', propertyId);
      }
      setErrorMsg(err?.message || 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Submit: dev-demo (original behavior) ─── */
  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !locationName || !basePrice) return;

    const selectedAmenityNames = Object.keys(demoAmenities).filter((k) => demoAmenities[k]);

    const newListing: Listing = {
      id: `listing-${Date.now()}`,
      title,
      location: locationName,
      price: parseInt(basePrice),
      rating: 5.0,
      reviewsCount: 0,
      image:
        'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=400&h=300&q=80',
      images: [
        'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=400&h=300&q=80',
        'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=400&h=300&q=80',
      ],
      distanceText,
      type: genderType,
      premium: false,
      verified: false,
      amenities: selectedAmenityNames,
      rooms: [{ name: 'Double Sharing', price: parseInt(basePrice), available: true }],
      owner: {
        name:
          profile?.full_name?.trim() ||
          (user?.user_metadata?.full_name as string)?.trim() ||
          (user?.email ? user.email.split('@')[0] : '') ||
          'Mrs. Sunita Gupta',
        phone: profile?.phone || (user?.user_metadata?.phone as string) || '+91 99999 88888',
        email: user?.email || profile?.email || 'sunita@pgfinder.com',
        avatar:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
      },
      description,
      reviews: [],
    };

    setListings((prev) => [...prev, newListing]);
    setSuccessMsg('Property listed successfully! It will go live after admin verification.');

    resetForm();
    setShowAddForm(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleSubmit = isRealOwner ? handleRealSubmit : handleDemoSubmit;

  /* ─── Shared input classes ─── */
  const inputCls =
    'w-full px-3 py-2 border border-[#B8D9B0] rounded-lg text-sm outline-none focus:border-primary bg-white';
  const labelCls = 'text-xs font-semibold text-[#7A8F7A]';

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white rounded-card p-6 shadow-level-1 border border-outline-variant">
        <div>
          <h1 className="text-xl font-bold text-primary">Manage Listings</h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Publish new rooms and check verification status.
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setErrorMsg(''); }}
          className="bg-deep-green hover:bg-primary text-on-primary px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
        >
          {showAddForm ? 'Cancel' : 'Add Property'}
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-xs font-bold text-deep-green animate-pulse">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-300 p-4 rounded-xl text-xs font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {/* ────────────── Add listing form ────────────── */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-card p-6 shadow-level-1 border border-[#B8D9B0] flex flex-col gap-4"
        >
          <h2 className="text-sm font-bold text-primary">List Your Property</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Property Title</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
                placeholder="e.g. Silver Oaks Residency"
              />
            </div>

            {/* Address */}
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Address</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls}
                placeholder="e.g. 42, MG Road, Sector 62"
              />
            </div>

            {/* Area / Location Name */}
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Area / Location Name</label>
              <input
                type="text"
                required
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Greater Noida"
              />
            </div>

            {/* Gender type */}
            <div className="flex flex-col gap-1">
              <label className={labelCls}>PG Category</label>
              <select
                value={genderType}
                onChange={(e) => setGenderType(e.target.value as 'Boys' | 'Girls' | 'Co-ed')}
                className={`${inputCls} cursor-pointer`}
              >
                <option value="Boys">Boys PG</option>
                <option value="Girls">Girls PG</option>
                <option value="Co-ed">Co-ed PG</option>
              </select>
            </div>

            {/* Base price */}
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Base Price per Month (₹)</label>
              <input
                type="number"
                required
                min={1}
                max={100000}
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className={inputCls}
                placeholder="e.g. 8000"
              />
            </div>

            {/* Contact phone */}
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Contact Phone (optional)</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className={inputCls}
                placeholder="e.g. +91 98765 43210"
              />
              <span className="text-[10px] text-on-surface-variant">
                These are shown publicly on your listing
              </span>
            </div>

            {/* Contact email */}
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Contact Email (optional)</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={inputCls}
                placeholder="e.g. owner@example.com"
              />
              <span className="text-[10px] text-on-surface-variant">
                These are shown publicly on your listing
              </span>
            </div>

            {/* Description */}
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className={labelCls}>Description</label>
              <textarea
                required
                rows={3}
                minLength={20}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${inputCls} resize-none`}
                placeholder="Describe rooms, safety facilities, curfew guidelines, etc. (20-2000 chars)"
              ></textarea>
            </div>

            {/* ──── Room Types ──── */}
            {isRealOwner && (
              <div className="md:col-span-2 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Room Types (1-4)</label>
                  {rooms.length < 4 && (
                    <button
                      type="button"
                      onClick={addRoom}
                      className="text-xs text-primary font-bold hover:underline cursor-pointer"
                    >
                      + Add Room Type
                    </button>
                  )}
                </div>
                {rooms.map((room, idx) => (
                  <div key={idx} className="grid grid-cols-3 sm:grid-cols-4 gap-2 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[#7A8F7A]">Name</label>
                      <input
                        type="text"
                        required
                        value={room.name}
                        onChange={(e) => updateRoom(idx, 'name', e.target.value)}
                        className={inputCls}
                        placeholder="e.g. Double Sharing"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[#7A8F7A]">Price (₹)</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={room.price}
                        onChange={(e) => updateRoom(idx, 'price', e.target.value)}
                        className={inputCls}
                        placeholder="8000"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[#7A8F7A]">Total Beds</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={10}
                        value={room.totalBeds}
                        onChange={(e) => updateRoom(idx, 'totalBeds', e.target.value)}
                        className={inputCls}
                        placeholder="2"
                      />
                    </div>
                    {rooms.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRoom(idx)}
                        className="text-xs text-red-500 font-bold hover:underline cursor-pointer pb-2"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* ──── Location picker ──── */}
            {isRealOwner && (
              <div className="md:col-span-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className={labelCls}>Pin Your Exact Location</label>
                  {manualPin && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualPin(false);
                        setPinStatus(
                          address.trim().length < 6
                            ? 'Type your address first.'
                            : 'Searching for this address…',
                        );
                      }}
                      className="text-xs font-bold text-primary hover:underline cursor-pointer"
                    >
                      Find from address again
                    </button>
                  )}
                </div>
                <LocationPicker value={pin} onChange={handleManualPin} flySignal={flySignal} />
                {pinStatus && <p className="text-xs text-on-surface-variant">{pinStatus}</p>}
                {distanceInfo && (
                  <p className="text-xs font-semibold text-deep-green bg-light-sage/30 rounded-lg px-3 py-2">
                    Distance to {COLLEGE.name}: about {distanceInfo.km} km ({distanceInfo.text}). Calculated automatically.
                  </p>
                )}
              </div>
            )}
            {/* ──── Amenities ──── */}
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className={labelCls}>Amenities Provided</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {isRealOwner
                  ? dbAmenities.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 text-xs text-on-surface cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAmenityIds.has(a.id)}
                        onChange={() => toggleAmenity(a.id)}
                        className="rounded border-[#B8D9B0] text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      {a.icon && <span className="text-sm">{a.icon}</span>}
                      {a.name}
                    </label>
                  ))
                  : Object.keys(demoAmenities).map((a) => (
                    <label
                      key={a}
                      className="flex items-center gap-2 text-xs text-on-surface cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={demoAmenities[a]}
                        onChange={() =>
                          setDemoAmenities((prev) => ({ ...prev, [a]: !prev[a] }))
                        }
                        className="rounded border-[#B8D9B0] text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      {a}
                    </label>
                  ))}
              </div>
            </div>

            {/* ──── Actions ──── */}
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-[#B8D9B0] rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-low cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-deep-green hover:bg-primary text-on-primary px-6 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Submit Listing'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ────────────── Property Listings grid ────────────── */}
      <div className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant flex flex-col gap-4">
        <h2 className="text-sm font-bold text-[#333333] border-b border-outline-variant pb-3">
          My Properties
        </h2>

        {isRealOwner ? (
          /* ─── Real owner: DB-backed list ─── */
          loadingProperties ? (
            <div className="text-center py-8 text-xs text-on-surface-variant">Loading…</div>
          ) : dbProperties.length > 0 ? (
            <div className="flex flex-col gap-4">
              {dbProperties.map((prop) => {
                const imgUrl = primaryImageUrl(prop.property_images);
                return (
                  <div
                    key={prop.id}
                    className="border border-outline-variant rounded-xl p-4 flex flex-col gap-4"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-outline-variant shrink-0 bg-surface-container-low flex items-center justify-center">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={prop.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-2xl text-outline-variant">
                              image
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-primary text-sm flex items-center gap-2">
                            {prop.title}
                            {prop.is_verified ? (
                              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                                Verified
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold">
                                Pending Review
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {prop.location_name}
                          </p>
                          <p className="text-xs text-on-surface-variant font-semibold mt-1">
                            ₹{prop.base_price.toLocaleString()}/mo
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-on-surface-variant font-medium">
                          {prop.rooms?.length ?? 0} room type{(prop.rooms?.length ?? 0) !== 1 ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePhotoPanel(prop.id)}
                          className="text-xs font-bold text-primary border border-primary px-3 py-1.5 rounded-lg hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
                        >
                          {expandedPhotoProp === prop.id ? 'Hide Photos' : 'Manage Photos'}
                        </button>
                      </div>
                    </div>

                    {/* ── Photo management panel ── */}
                    {expandedPhotoProp === prop.id && (
                      <div className="border-t border-outline-variant pt-4 flex flex-col gap-3">
                        {photoError[prop.id] && (
                          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {photoError[prop.id]}
                          </div>
                        )}

                        {/* Thumbnails */}
                        {photoLoading[prop.id] ? (
                          <div className="text-xs text-on-surface-variant py-4 text-center">Loading photos…</div>
                        ) : (propPhotos[prop.id] && propPhotos[prop.id].length > 0) ? (
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {propPhotos[prop.id].map((photo) => (
                              <div
                                key={photo.id}
                                className="relative group rounded-lg overflow-hidden border border-outline-variant aspect-square bg-surface-container-low"
                              >
                                <img
                                  src={photo.image_url}
                                  alt={photo.caption || 'Property photo'}
                                  className="w-full h-full object-cover"
                                />
                                {photo.is_primary && (
                                  <span className="absolute top-1 left-1 bg-primary text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded">
                                    Cover
                                  </span>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                  {!photo.is_primary && (
                                    <button
                                      type="button"
                                      disabled={!!photoSaving[prop.id]}
                                      onClick={() => handleMakeCover(prop.id, photo)}
                                      className="text-[9px] font-bold bg-white text-primary px-2 py-1 rounded hover:bg-primary hover:text-on-primary transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      Cover
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={!!photoSaving[prop.id]}
                                    onClick={() => handleDeletePhoto(prop.id, photo)}
                                    className="text-[9px] font-bold bg-white text-red-600 px-2 py-1 rounded hover:bg-red-600 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-on-surface-variant py-2">No photos yet.</p>
                        )}

                        {/* Upload statuses */}
                        {uploadStatuses.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {uploadStatuses.map((s, idx) => (
                              <div key={idx} className="text-[11px] flex items-center gap-2">
                                <span className="truncate max-w-[120px]">{s.name}</span>
                                {s.state === 'compressing' && <span className="text-amber-600 font-semibold">Compressing…</span>}
                                {s.state === 'uploading' && <span className="text-blue-600 font-semibold">Uploading…</span>}
                                {s.state === 'saving' && <span className="text-purple-600 font-semibold">Saving…</span>}
                                {s.state === 'done' && <span className="text-emerald-600 font-semibold">✓ Done</span>}
                                {s.state === 'error' && <span className="text-red-600 font-semibold">✗ {s.error}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload input */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-primary border border-primary px-3 py-1.5 rounded-lg hover:bg-primary hover:text-on-primary transition-colors cursor-pointer inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
                            Add Photos
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              multiple
                              className="hidden"
                              disabled={!!photoSaving[prop.id]}
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handlePhotoUpload(prop.id, e.target.files);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                          <span className="text-[10px] text-on-surface-variant">
                            JPEG, PNG, WebP · Max 15 MB each · {6 - (propPhotos[prop.id]?.length ?? 0)} remaining
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-5xl text-outline-variant">
                holiday_village
              </span>
              <p className="text-sm font-medium text-on-surface-variant">
                You haven&apos;t listed any properties yet
              </p>
              <p className="text-xs text-on-surface-variant max-w-sm">
                Add your PG accommodation to start receiving visit requests from students.
              </p>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-deep-green hover:bg-primary text-on-primary px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer mt-1"
                >
                  Add Property
                </button>
              )}
            </div>
          )
        ) : (
          /* ─── Dev-demo: mock context list ─── */
          ownerListings.length > 0 ? (
            <div className="flex flex-col gap-4">
              {ownerListings.map((listing) => (
                <div
                  key={listing.id}
                  className="border border-outline-variant rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-outline-variant shrink-0 bg-surface-container-low">
                      <img
                        src={listing.image}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary text-sm flex items-center gap-2">
                        {listing.title}
                        {listing.verified ? (
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                            Verified
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold">
                            Pending Review
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-on-surface-variant mt-0.5">{listing.location}</p>
                      <p className="text-xs text-on-surface-variant font-semibold mt-1">
                        ₹{listing.price.toLocaleString()}/mo
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant font-medium">
                      Rating: {listing.rating} ★
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-5xl text-outline-variant">
                holiday_village
              </span>
              <p className="text-sm font-medium text-on-surface-variant">
                You haven&apos;t listed any properties yet
              </p>
              <p className="text-xs text-on-surface-variant max-w-sm">
                Add your PG accommodation to start receiving visit requests from students.
              </p>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-deep-green hover:bg-primary text-on-primary px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer mt-1"
                >
                  Add Property
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
