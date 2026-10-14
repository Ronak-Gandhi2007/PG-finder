'use client';

import React, { useState } from 'react';
import { usePersona, Listing } from '@/context/PersonaContext';
import { useRouter } from 'next/navigation';
import { getInitials } from '@/lib/utils';
import PropertyMap from '@/components/PropertyMap';


interface ListingClientProps {
  listing: Listing;
}

export default function ListingClient({ listing }: ListingClientProps) {
  const router = useRouter();
  const { addBooking, role, requireAuth } = usePersona();

  // States
  const [selectedImage, setSelectedImage] = useState<string>(listing.image || (listing.images && listing.images[0]) || '');
  const [bookingDate, setBookingDate] = useState<string>('');
  const [bookingTime, setBookingTime] = useState<string>('Morning (10 AM - 12 PM)');
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isNew = listing.rating === 0 || listing.reviewsCount === 0;

  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'GUEST') {
      router.push('/auth');
      return;
    }
    if (isOwnerOrAdmin) {
      return;
    }
    if (!bookingDate) {
      setErrorMessage('Please select a date for your visit.');
      return;
    }

    setErrorMessage('');

    const result = await addBooking({
      listingId: listing.id,
      listingTitle: listing.title,
      listingImage: listing.image,
      date: bookingDate,
      timeSlot: bookingTime,
      ownerName: listing.owner.name,
      studentName: '',
      studentEmail: '',
      studentPhone: '',
    });

    if (result && typeof result === 'object' && 'error' in result && result.error) {
      setErrorMessage(result.error);
      return;
    }

    setBookingSuccess(true);
  };

  const getAmenityIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('wifi')) return 'wifi';
    if (n.includes('laundry')) return 'local_laundry_service';
    if (n.includes('ac') || n.includes('air conditioning')) return 'ac_unit';
    if (n.includes('gym')) return 'fitness_center';
    if (n.includes('food') || n.includes('meal')) return 'restaurant';
    if (n.includes('cctv')) return 'videocam';
    if (n.includes('security') || n.includes('biometric')) return 'shield';
    if (n.includes('water')) return 'water_drop';
    if (n.includes('study')) return 'menu_book';
    return 'check_circle';
  };

  return (
    <main className="w-full max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl flex flex-col gap-xl">
      {/* Success Notification Banner */}
      {bookingSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <div>
              <h4 className="font-bold text-deep-green">Visit Request Scheduled!</h4>
              <p className="text-sm text-on-secondary-container">
                Your tour for {listing.title} on {bookingDate} during {bookingTime} has been submitted.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(role === 'STUDENT' ? '/dashboard/student' : '/')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
          >
            {role === 'STUDENT' ? 'View Dashboard' : 'Back to Home'}
          </button>
        </div>
      )}

      {/* Title & Location Header */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-headline-lg text-headline-lg text-[#333333] font-bold">
            {listing.title}
          </h1>
          {listing.verified && (
            <span className="bg-secondary-container text-deep-green px-3 py-1 rounded-full font-label-sm text-xs flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              Verified PG
            </span>
          )}
          <span className="bg-light-sage/50 text-deep-green px-3 py-1 rounded-full font-label-sm text-xs font-semibold">
            {listing.type} Accommodation
          </span>
          {isNew ? (
            <span className="bg-light-sage/50 text-deep-green px-3 py-1 rounded-full font-label-sm text-xs font-semibold">
              New
            </span>
          ) : (
            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-label-sm text-xs flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              {listing.rating} ({listing.reviewsCount} review{listing.reviewsCount === 1 ? '' : 's'})
            </span>
          )}
        </div>
        <p className="text-subtext flex items-center gap-1 font-body-md text-sm text-[#7A8F7A]">
          <span className="material-symbols-outlined text-[18px]">location_on</span>
          {listing.location} — {listing.distanceText}
        </p>
      </section>

      {/* Top Grid: Gallery & Owner Card */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Gallery */}
        <div className="lg:col-span-2 bg-white rounded-card p-4 md:p-6 shadow-level-1 flex flex-col gap-4 border border-outline-variant">
          <div className="w-full aspect-[16/9] rounded-[18px] overflow-hidden relative border border-outline-variant bg-surface-container-low flex items-center justify-center">
            {selectedImage || listing.image ? (
              <img
                className="w-full h-full object-cover transition-all duration-300"
                src={selectedImage || listing.image}
                alt={listing.title || 'Listing room view'}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-on-surface-variant gap-2 p-6">
                <span className="material-symbols-outlined text-5xl text-outline-variant">image</span>
                <span className="text-sm font-medium">No images available for this property</span>
              </div>
            )}
          </div>
          {/* Thumbnails */}
          {listing.images && listing.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {listing.images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(img)}
                  className={`w-24 aspect-[4/3] rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer hover:opacity-80 transition-all ${(selectedImage || listing.image) === img ? 'border-deep-green scale-95' : 'border-transparent'
                    }`}
                >
                  <img src={img} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Owner Info Card */}
        <div className="bg-white rounded-card p-6 shadow-level-1 flex flex-col items-center justify-center gap-4 text-center border border-outline-variant">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#B8D9B0] shadow-sm bg-surface-container-low flex items-center justify-center">
            {listing.owner.avatar ? (
              <img
                className="w-full h-full object-cover"
                src={listing.owner.avatar}
                alt={listing.owner.name}
              />
            ) : (
              <span className="text-2xl font-bold text-deep-green">
                {getInitials(listing.owner.name, listing.owner.email)}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-headline-md text-lg font-bold text-[#333333]">{listing.owner.name}</h3>
            <p className="text-xs text-on-surface-variant font-medium">Property Owner</p>
          </div>
          <div className="bg-surface-container-low px-4 py-1.5 rounded-full text-secondary flex items-center gap-1 font-label-sm text-xs font-semibold">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            Verified Owner
          </div>

          <div className="w-full border-t border-outline-variant pt-4 mt-2 flex flex-col gap-2">
            {listing.owner.phone ? (
              <a
                href={`tel:${listing.owner.phone}`}
                className="w-full text-center py-2.5 text-xs font-bold text-deep-green border border-deep-green rounded-lg hover:bg-light-sage/20 transition-colors"
              >
                Call: {listing.owner.phone}
              </a>
            ) : (
              <span className="w-full text-center py-2.5 text-xs font-medium text-on-surface-variant border border-outline-variant rounded-lg">
                Phone not available
              </span>
            )}
            {listing.owner.email ? (
              <a
                href={`mailto:${listing.owner.email}`}
                className="w-full text-center py-2.5 text-xs font-bold text-on-primary bg-deep-green rounded-lg hover:bg-primary transition-colors"
              >
                Email Owner
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* Main Details and Booking Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Details Area */}
        <div className="lg:col-span-2 flex flex-col gap-8">

          {/* Description */}
          <section className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant">
            <h2 className="font-headline-md text-lg font-bold text-[#333333] mb-4">About this PG</h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {listing.description || 'No description provided for this accommodation.'}
            </p>
          </section>

          {/* Room Options */}
          <section className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant">
            <h2 className="font-headline-md text-lg font-bold text-[#333333] mb-4">Room Options</h2>
            {listing.rooms && listing.rooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {listing.rooms.map((room, idx) => (
                  <div
                    key={idx}
                    className={`border border-outline-variant rounded-xl p-4 flex flex-col gap-1.5 ${room.available ? 'bg-white' : 'bg-surface-container-low opacity-60'
                      }`}
                  >
                    <span className="font-label-md text-xs text-on-surface-variant font-semibold flex justify-between items-center">
                      {room.name}
                      {room.available ? (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">Available</span>
                      ) : (
                        <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold">Filled</span>
                      )}
                    </span>
                    <span className="font-headline-md text-xl text-primary font-bold">
                      ₹{room.price.toLocaleString()}
                      <span className="text-xs text-[#7A8F7A] font-normal">/mo</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant italic">No specific room configurations listed.</p>
            )}
          </section>

          {/* Amenities */}
          <section className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant">
            <h2 className="font-headline-md text-lg font-bold text-[#333333] mb-4">Amenities</h2>
            {listing.amenities && listing.amenities.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {listing.amenities.map((amenity) => (
                  <div key={amenity} className="flex items-center gap-2.5 text-on-surface-variant font-body-md text-sm">
                    <span className="material-symbols-outlined text-primary font-medium">
                      {getAmenityIcon(amenity)}
                    </span>
                    {amenity}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant italic">No amenities listed.</p>
            )}
          </section>

          {/* House Rules */}
          <section className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant">
            <h2 className="font-headline-md text-lg font-bold text-[#333333] mb-4">House Rules</h2>
            <div className="flex flex-wrap gap-2.5">
              {['10PM Curfew', 'No Guests After 9PM', 'No Induction Cooking', 'Govt ID Proof Required'].map((rule) => (
                <span key={rule} className="bg-light-sage/40 text-deep-green px-4 py-2 rounded-full font-label-md text-xs font-semibold">
                  {rule}
                </span>
              ))}
            </div>
          </section>

          {/* Location & Map Section */}
          <section className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant">
            <h2 className="font-headline-md text-lg font-bold text-[#333333] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">map</span>
              Location & Map
            </h2>
            <div className="flex flex-col gap-4">
              {listing.latitude != null && listing.longitude != null ? (
                <>
                  <PropertyMap
                    points={[{
                      id: listing.id,
                      lat: listing.latitude,
                      lng: listing.longitude,
                      name: listing.title,
                    }]}
                    height={256}
                  />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${listing.latitude},${listing.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start text-xs font-bold text-deep-green border border-deep-green rounded-lg px-4 py-2 hover:bg-light-sage/20 transition-colors"
                  >
                    Get directions
                  </a>
                </>
              ) : (
                <div className="w-full h-64 rounded-xl border border-outline-variant bg-surface-container-low flex items-center justify-center text-sm text-on-surface-variant">
                  Exact location not available for this property.
                </div>
              )}
              <div className="flex items-start gap-3 bg-light-sage/20 p-4 rounded-xl">
                <span className="material-symbols-outlined text-deep-green mt-0.5">directions_walk</span>
                <div>
                  <h4 className="font-bold text-deep-green text-sm">Directions to College</h4>
                  <p className="text-xs text-on-surface-variant mt-1">{listing.distanceText}. Safe neighborhood with well-lit streets.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Reviews List */}
          <section className="bg-white rounded-card p-6 shadow-level-1 border border-outline-variant">
            <h2 className="font-headline-md text-lg font-bold text-[#333333] mb-4">
              Student Reviews ({listing.reviews ? listing.reviews.length : 0})
            </h2>
            {listing.reviews && listing.reviews.length > 0 ? (
              <div className="space-y-4">
                {listing.reviews.map((rev) => (
                  <div key={rev.id} className="border-b border-outline-variant pb-4 last:border-b-0 last:pb-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-primary text-sm">{rev.author}</h4>
                      <div className="flex items-center gap-0.5 text-amber-500">
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="text-xs font-bold text-on-surface">{rev.rating}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-on-surface-variant block mb-2">{rev.date}</span>
                    <p className="text-sm text-on-surface-variant italic">
                      "{rev.comment}"
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant italic">No reviews yet.</p>
            )}
          </section>
        </div>

        {/* Tour Booking Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-card p-6 shadow-level-2 border border-[#B8D9B0] sticky top-28 flex flex-col gap-4">
            <h2 className="font-headline-md text-lg font-bold text-primary">Book a Free Visit</h2>
            <p className="text-xs text-on-surface-variant -mt-2">
              Select your preferred date and time slot to view the property in person.
            </p>

            <form onSubmit={handleBookingSubmit} className="flex flex-col gap-4">
              {errorMessage && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                  {errorMessage}
                </div>
              )}

              {/* Date Input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-xs text-[#7A8F7A] font-semibold">Select Date</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">calendar_today</span>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#B8D9B0] focus:border-primary focus:ring-0 outline-none text-sm font-body-md bg-white cursor-pointer"
                  />
                </div>
              </div>

              {/* Time Slot Select */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-xs text-[#7A8F7A] font-semibold">Preferred Time</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">schedule</span>
                  <select
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-[#B8D9B0] focus:border-primary focus:ring-0 outline-none text-sm font-body-md bg-white appearance-none cursor-pointer"
                  >
                    <option value="Morning (10 AM - 12 PM)">Morning (10 AM - 12 PM)</option>
                    <option value="Afternoon (1 PM - 4 PM)">Afternoon (1 PM - 4 PM)</option>
                    <option value="Evening (5 PM - 7 PM)">Evening (5 PM - 7 PM)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">expand_more</span>
                </div>
              </div>

              <p className="text-[11px] text-on-surface-variant text-center">
                Your name, email and phone will be shared with the property owner.
              </p>

              <button
                type="submit"
                disabled={bookingSuccess || isOwnerOrAdmin}
                className={`w-full text-center py-3 rounded-lg font-label-md text-sm font-bold transition-all shadow-sm mt-2 ${bookingSuccess || isOwnerOrAdmin
                  ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                  : 'bg-deep-green hover:bg-primary hover:scale-[0.98] text-on-primary cursor-pointer'
                  }`}
              >
                {isOwnerOrAdmin
                  ? 'Only students can request visits'
                  : bookingSuccess
                    ? 'Visit Requested'
                    : role === 'GUEST'
                      ? 'Sign In to Request Visit'
                      : 'Confirm Visit Request'}
              </button>
            </form>

            <p className="text-center text-[10px] text-on-surface-variant font-medium">
              No reservation or broker fees. Free cancellation.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
