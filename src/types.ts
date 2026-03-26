export interface KakiNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'event_recommendation' | 'event_reminder' | 'community_update';
  eventId?: string;
  read: boolean;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  ethnicity?: string;
  religion?: string;
  bio?: string;
  interests?: string[];
  isPartner?: boolean;
  instagramHandle?: string;
  onboardingCompleted?: boolean;
  readNotificationIds?: string[];
  createdAt: string;
}

export interface KakiEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  lat?: number;
  lng?: number;
  date: string;
  time: string;
  organizerId: string;
  organizerName: string;
  isPartnerEvent?: boolean;
  instagramLink?: string;
  category: 'MakanKaki' | 'Festival' | 'Religious' | 'Cultural' | 'Community' | 'JalanKaki' | 'SembangKaki';
  kakiTag?: 'DurianKaki' | 'JalanKaki' | 'SembangKaki' | 'MakanKaki' | string;
  ethnicityTag?: string;
  religionTag?: string;
  attendees: string[];
  capacity: number;
  price: number;
  imageUrl?: string;
  rating?: number;
  createdAt: string;
}
