/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, query, onSnapshot, addDoc, updateDoc, doc, arrayUnion, arrayRemove, setDoc, getDoc,
  handleFirestoreError, OperationType
} from './firebase';
import { KakiEvent, UserProfile } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, LogIn, LogOut, MapPin, Calendar, Clock, Users, 
  Heart, Filter, Search, Info, X, ChevronRight, Flower2, Utensils, Languages,
  Bell, Leaf, Sparkles, Map as MapIcon, Navigation, Star, Instagram, CheckCircle2,
  Camera, TrendingUp
} from 'lucide-react';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { KakiNotification } from './types';
import { Language, translations } from './translations';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
const KakiIcon = L.divIcon({
  html: `<div class="w-8 h-8 bg-[#C05E41] rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const KakiIconGreen = L.divIcon({
  html: `<div class="w-8 h-8 bg-[#2D4F3E] rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// Sacred Botanicals & Contemporary Mysticism Palette
const COLORS = {
  terracotta: '#C05E41',
  teal: '#2D4F3E',
  rose: '#D4A5A5',
  lotus: '#B56576',
  sage: '#829399',
  parchment: '#F5F2ED',
  ivory: '#FDFBF7'
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) message = `Firestore Error: ${parsed.error} (${parsed.operationType} at ${parsed.path})`;
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="h-screen flex items-center justify-center bg-[#F9F7F2] p-4 text-center">
          <div className="max-w-md bg-white p-8 rounded-3xl shadow-xl border border-orange-100">
            <h2 className="text-2xl font-bold text-[#C05E41] mb-4">Waduh! Error Occurred</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#2D4F3E] text-white rounded-xl font-bold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const getEventImage = (event: KakiEvent) => {
  if (event.imageUrl) return event.imageUrl;
  const images: Record<string, string> = {
    'Festival': 'https://images.unsplash.com/photo-1545127398-14699f92334b?auto=format&fit=crop&q=80&w=800',
    'Religious': 'https://images.unsplash.com/photo-1605197509751-62ad15fc0a16?auto=format&fit=crop&q=80&w=800',
    'Cultural': 'https://images.unsplash.com/photo-1582738411706-bfc8e691d1c2?auto=format&fit=crop&q=80&w=800',
    'Community': 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800',
    'JalanKaki': 'https://images.unsplash.com/photo-1596422846543-b5c64881fe53?auto=format&fit=crop&q=80&w=800',
    'DurianKaki': 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&q=80&w=800',
    'SembangKaki': 'https://images.unsplash.com/photo-1554118811-1e0d58224f22?auto=format&fit=crop&q=80&w=800',
    'MakanKaki': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800'
  };
  // Check kakiTag first for more specific imagery
  if (event.kakiTag && images[event.kakiTag]) {
    return images[event.kakiTag];
  }
  return images[event.category] || `https://images.unsplash.com/photo-1528150232583-f643a633865e?auto=format&fit=crop&q=80&w=800`;
};

function EventCard({ event, onClick, t, user, toggleJoinEvent }: { event: KakiEvent, onClick: (e: KakiEvent) => void, t: any, user: UserProfile | null, toggleJoinEvent: (e: KakiEvent) => void }) {
  const isTopPick = event.rating && event.rating >= 4.8;

  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className={`cursor-pointer group ${isTopPick ? 'top-pick-card' : 'sacred-card'}`}
    >
      <div 
        className="relative h-64 overflow-hidden"
        onClick={() => onClick(event)}
      >
        <img 
          src={getEventImage(event)} 
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          {event.isPartnerEvent && (
            <span className="px-3 py-1 bg-[#2D4F3E] text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1.5 border border-white/20">
              <CheckCircle2 className="w-3 h-3" />
              {t.partners.verified}
            </span>
          )}
          <span className="px-3 py-1 bg-white/95 backdrop-blur-md text-[#2D4F3E] text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg">
            {event.category}
          </span>
          {event.kakiTag && (
            <span className="px-3 py-1 bg-[#2D4F3E] text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg">
              {event.kakiTag}
            </span>
          )}
          {event.ethnicityTag && (
            <span className="px-3 py-1 bg-[#C05E41]/95 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg">
              {event.ethnicityTag}
            </span>
          )}
          {isTopPick && (
            <span className="px-3 py-1 bg-yellow-400 text-[#2D4F3E] text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" />
              {t.topPicks}
            </span>
          )}
        </div>
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[#C05E41] font-bold text-sm shadow-lg">
          {event.price === 0 ? 'FREE' : `RM ${event.price}`}
        </div>
      </div>
      
      <div className="p-8">
        <h4 
          className="text-2xl font-serif font-bold text-[#2D4F3E] mb-3 line-clamp-1 group-hover:text-[#C05E41] transition-colors"
          onClick={() => onClick(event)}
        >
          {event.title}
        </h4>
        
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <Calendar className="w-4 h-4 text-[#C05E41]" />
            {format(new Date(event.date), 'MMM d, yyyy')}
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <MapPin className="w-4 h-4 text-[#2D4F3E]" />
            {event.location}
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-6 border-t border-[#E6C9A8]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E6C9A8]/30 flex items-center justify-center text-[#8B4513] font-bold border-2 border-white shadow-sm">
              {event.organizerName?.charAt(0)}
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider leading-none mb-1">{t.hostedBy}</p>
              <p className="text-xs font-bold text-[#2D4F3E] flex items-center gap-1">
                {event.organizerName}
                {event.isPartnerEvent && <CheckCircle2 className="w-3 h-3 text-[#2D4F3E]" />}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {event.instagramLink && (
              <a 
                href={event.instagramLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 text-pink-600 hover:bg-pink-50 rounded-full transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Instagram className="w-4 h-4" />
              </a>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleJoinEvent(event);
              }}
              disabled={!user}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-bold transition-all duration-300",
                event.attendees.includes(user?.uid || '')
                  ? "bg-green-100 text-green-700"
                  : "bg-[#2D4F3E] text-white hover:bg-[#1D3F2E] shadow-lg shadow-green-900/10"
              )}
            >
              {event.attendees.includes(user?.uid || '') ? (
                <Heart className="w-4 h-4 fill-current" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [events, setEvents] = useState<KakiEvent[]>([]);
  const [notifications, setNotifications] = useState<KakiNotification[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isHostDropdownOpen, setIsHostDropdownOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<KakiEvent | null>(null);
  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const t = translations[language];

  // Auth Listener
  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as UserProfile);
          } else {
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              onboardingCompleted: false,
              interests: [],
              createdAt: new Date().toISOString(),
            };
            setDoc(userRef, newUser);
            setUser(newUser);
          }
          setAuthReady(true);
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setAuthReady(true);
          setLoading(false);
        });
      } else {
        setUser(null);
        setAuthReady(true);
        setLoading(false);
      }
    });
    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
    };
  }, []);

  // Events Listener - Only attach when auth is ready and user is logged in
  useEffect(() => {
    if (!authReady || !user) {
      setEvents([]);
      return;
    }

    const path = 'events';
    const q = query(collection(db, path));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KakiEvent[];
      setEvents(eventList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      
      // Derive notifications for new events matching interests
      if (user?.interests && user.interests.length > 0) {
        const newNotifications: KakiNotification[] = eventList
          .filter(e => {
            const isNew = new Date(e.createdAt).getTime() > new Date(user.createdAt).getTime();
            const matchesInterest = user.interests?.some(interest => 
              e.category.toLowerCase().includes(interest.toLowerCase()) || 
              e.ethnicityTag?.toLowerCase().includes(interest.toLowerCase())
            );
            const isRead = user.readNotificationIds?.includes(`notif-${e.id}`);
            return isNew && matchesInterest && !isRead;
          })
          .map(e => ({
            id: `notif-${e.id}`,
            userId: user.uid,
            title: t.notifTitle,
            message: t.notifMessage
              .replace('{category}', t.filters[e.category.toLowerCase() as keyof typeof t.filters] || e.category)
              .replace('{title}', e.title),
            type: 'event_recommendation',
            eventId: e.id,
            read: false,
            createdAt: e.createdAt
          }));
        setNotifications(newNotifications);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, [authReady, user?.uid, user?.interests, user?.readNotificationIds]);

  const markNotificationAsRead = async (notificationId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        readNotificationIds: arrayUnion(notificationId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!user || notifications.length === 0) return;
    try {
      const allIds = notifications.map(n => n.id);
      await updateDoc(doc(db, 'users', user.uid), {
        readNotificationIds: arrayUnion(...allIds)
      });
      setIsNotificationsOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const toggleJoinEvent = async (event: KakiEvent) => {
    if (!user) return;
    const isAttending = event.attendees.includes(user.uid);
    const path = `events/${event.id}`;
    const eventRef = doc(db, 'events', event.id);
    try {
      await updateDoc(eventRef, {
        attendees: isAttending ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const filteredEvents = events.filter(e => {
    const matchesFilter = filter === 'All' || e.category === filter || e.kakiTag === filter;
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (e.kakiTag && e.kakiTag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F9F7F2]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Flower2 className="w-12 h-12 text-[#C05E41]" />
        </motion.div>
      </div>
    );
  }

  if (user && !user.onboardingCompleted) {
    return (
      <OnboardingFlow 
        user={user} 
        onComplete={(updatedUser) => setUser(updatedUser)} 
        t={t}
      />
    );
  }

  const recommendedEvents = events.filter(e => 
    user?.interests?.some(interest => 
      e.category.toLowerCase().includes(interest.toLowerCase()) || 
      e.ethnicityTag?.toLowerCase().includes(interest.toLowerCase()) ||
      e.religionTag?.toLowerCase().includes(interest.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-[#F9F7F2] text-[#2D2D2D] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E6C9A8]/20">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#2D4F3E] rounded-2xl flex items-center justify-center text-[#E6C9A8] shadow-lg shadow-green-900/20">
              <Flower2 className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-serif font-bold tracking-tight text-[#2D4F3E]">
              Kaki
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#E6C9A8]/10 p-1 rounded-2xl border border-[#E6C9A8]/20">
              {(['en', 'ms', 'zh'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all uppercase",
                    language === lang 
                      ? "bg-[#2D4F3E] text-white shadow-md" 
                      : "text-[#2D4F3E] hover:bg-[#E6C9A8]/20"
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>

            {user ? (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <button 
                    onClick={() => setIsHostDropdownOpen(!isHostDropdownOpen)}
                    className="nature-button bg-transparent text-[#2D4F3E] hover:bg-[#2D4F3E]/10 flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">{t.hostButton}</span>
                  </button>
                  <AnimatePresence>
                    {isHostDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#E6C9A8]/30 overflow-hidden z-50"
                      >
                        <button 
                          onClick={() => {
                            setIsEventModalOpen(true);
                            setIsHostDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 text-[#2D4F3E] font-bold flex items-center gap-2 border-b border-gray-100"
                        >
                          <Plus className="w-4 h-4" />
                          {t.createEvent}
                        </button>
                        <button 
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-400 font-medium flex items-center gap-2 cursor-not-allowed"
                        >
                          <Calendar className="w-4 h-4" />
                          My Hosted Events
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative">
                  <button 
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="p-3 hover:bg-[#E6C9A8]/20 text-[#2D4F3E] rounded-2xl transition-all relative"
                  >
                    <Bell className="w-6 h-6" />
                    {notifications.length > 0 && (
                      <span className="absolute top-2 right-2 w-3 h-3 bg-[#C05E41] border-2 border-white rounded-full" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {isNotificationsOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-80 bg-white rounded-[2rem] shadow-2xl border border-[#E6C9A8]/30 overflow-hidden z-50"
                      >
                        <div className="p-4 bg-[#2D4F3E] text-white flex items-center justify-between">
                          <h4 className="font-bold">Notifications</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{notifications.length} New</span>
                            {notifications.length > 0 && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAllNotificationsAsRead();
                                }}
                                className="text-[10px] uppercase font-bold text-[#E6C9A8] hover:text-white transition-colors"
                              >
                                Clear All
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-96 overflow-y-auto p-2">
                          {notifications.length > 0 ? (
                            notifications.map(notif => (
                              <div 
                                key={notif.id} 
                                onClick={() => {
                                  markNotificationAsRead(notif.id);
                                  const event = events.find(e => e.id === notif.eventId);
                                  if (event) setSelectedEvent(event);
                                  setIsNotificationsOpen(false);
                                }}
                                className="p-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer border-b border-gray-50 last:border-0"
                              >
                                <div className="flex gap-3">
                                  <div className="w-10 h-10 bg-[#E6C9A8]/20 rounded-xl flex items-center justify-center text-[#8B4513] shrink-0">
                                    <Sparkles className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-[#2D4F3E]">{notif.title}</p>
                                    <p className="text-xs text-gray-500 line-clamp-2">{notif.message}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{format(new Date(notif.createdAt), 'p')}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-10 text-center text-gray-400">
                              <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
                              <p className="text-sm">{t.noNotifications}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-2 p-1 pr-3 bg-white border border-[#E6C9A8]/30 rounded-full hover:shadow-md transition-all"
                >
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName} 
                    className="w-8 h-8 rounded-full border border-[#E6C9A8]"
                    referrerPolicy="no-referrer"
                  />
                  <span className="hidden sm:block text-sm font-bold text-[#2D4F3E]">{user.displayName.split(' ')[0]}</span>
                </button>
                
                <button 
                  onClick={handleLogout}
                  className="p-3 hover:bg-orange-50 text-[#C05E41] rounded-2xl transition-colors"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="nature-button bg-[#2D4F3E] text-white shadow-lg shadow-green-900/20 flex items-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                {t.login}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center px-4 overflow-hidden">
        {/* Aesthetic Background with Mood Lighting & MCM Elements */}
        <div className="absolute inset-0 z-0 bg-[#2D4F3E]">
          {/* Mood Lighting Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(230,201,168,0.15),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(192,94,65,0.1),transparent_60%)]" />
          
          {/* Abstract MCM / Lotus Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
              className="absolute -top-20 -left-20 w-[600px] h-[600px] border-[1px] border-[#E6C9A8]/30 rounded-full"
            />
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
              className="absolute -bottom-40 -right-40 w-[800px] h-[800px] border-[1px] border-[#E6C9A8]/20 rounded-full"
            />
            
            {/* Stylized Lotus Shapes (MCM Style) */}
            <div className="absolute top-1/4 right-10 w-32 h-32 text-[#E6C9A8]/10">
              <Flower2 className="w-full h-full rotate-12" />
            </div>
            <div className="absolute bottom-1/4 left-10 w-48 h-48 text-[#E6C9A8]/10">
              <Leaf className="w-full h-full -rotate-45" />
            </div>
          </div>

          {/* Grainy Overlay */}
          <div className="absolute inset-0 opacity-30 pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/asfalt-dark.png")' }}></div>
          
          {/* Bottom Fade to Content */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#F9F7F2]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-widest rounded-full mb-8 border border-white/30">
              <Leaf className="w-4 h-4" />
              {t.heroBadge}
            </div>
            <h2 className="text-6xl sm:text-8xl font-serif font-bold text-white leading-tight mb-8 drop-shadow-2xl">
              {t.heroTitlePart1}<span className="text-[#E6C9A8] italic">{t.heroTitlePart2}</span>{t.heroTitlePart3}
            </h2>
            <p className="text-xl text-white/90 mb-12 leading-relaxed font-medium max-w-2xl mx-auto drop-shadow-lg">
              {t.heroSubtitle}
            </p>

            {/* Discovery Bar */}
            <div className="bg-white/95 backdrop-blur-xl p-4 sm:p-6 rounded-[3rem] shadow-2xl border border-white/50 max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 w-full">
                <span className="text-[#2D4F3E] font-bold whitespace-nowrap">{t.discovery.prefix}</span>
                <select 
                  className="bg-[#F9F7F2] border border-[#E6C9A8]/30 rounded-2xl px-4 py-3 text-[#2D4F3E] font-bold outline-none focus:ring-2 focus:ring-[#C05E41]/20 w-full"
                  onChange={(e) => setSearchQuery(e.target.value)}
                >
                  <option value="">{t.discovery.ethnicity}</option>
                  {t.discovery.ethnicities.map((e: string) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                <span className="text-[#2D4F3E] font-bold">{t.discovery.middle}</span>
                <select 
                  className="bg-[#F9F7F2] border border-[#E6C9A8]/30 rounded-2xl px-4 py-3 text-[#2D4F3E] font-bold outline-none focus:ring-2 focus:ring-[#C05E41]/20 w-full"
                  onChange={(e) => setSearchQuery(e.target.value)}
                >
                  <option value="">{t.discovery.area}</option>
                  {t.discovery.areas.map((a: string) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={() => {
                  const element = document.getElementById('community-feed');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-[#C05E41] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#A04E31] transition-all shadow-lg shadow-orange-900/20 w-full sm:w-auto"
              >
                {t.discovery.search}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-20">
        {/* Cultural Spotlight */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-3xl font-serif font-bold text-[#2D4F3E]">{t.culturalSpotlight}</h3>
              <p className="text-gray-500">{t.culturalSpotlightSub}</p>
            </div>
            <div className="hidden sm:flex gap-2">
              <div className="w-10 h-10 rounded-full border border-[#E6C9A8] flex items-center justify-center text-[#2D4F3E] opacity-50">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </div>
              <div className="w-10 h-10 rounded-full border border-[#E6C9A8] flex items-center justify-center text-[#2D4F3E]">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div 
              whileHover={{ y: -5 }}
              className="relative h-80 rounded-[2.5rem] overflow-hidden group cursor-pointer border-4 border-white shadow-xl"
            >
              <img 
                src="https://www.jellyrollfabric.net/cdn/shop/files/122556633-122556633-DotsandSwirlsGreenApple.jpg?v=1770826970" 
                alt="Batik Dots and Swirls" 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#B56576]/90 via-transparent to-transparent" />
              <div className="absolute bottom-8 left-8 right-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-[#C05E41] text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                    {t.tradition}
                  </span>
                  <Leaf className="w-4 h-4 text-[#E6C9A8] opacity-50" />
                </div>
                <h4 className="text-2xl font-serif font-bold text-white mb-2">{t.spotlight1Title}</h4>
                <p className="text-white/80 text-sm line-clamp-2">{t.spotlight1Desc}</p>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="relative h-80 rounded-[2.5rem] overflow-hidden group cursor-pointer border-4 border-white shadow-xl"
            >
              <img 
                src="https://i.pinimg.com/1200x/0e/36/35/0e363528a2fef40109f83284a03cc93b.jpg" 
                alt="Deepavali Festival" 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#C05E41]/90 via-transparent to-transparent" />
              <div className="absolute bottom-8 left-8 right-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-[#2D4F3E] text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                    {t.festivalBadge}
                  </span>
                  <Sparkles className="w-4 h-4 text-[#E6C9A8] opacity-50" />
                </div>
                <h4 className="text-2xl font-serif font-bold text-white mb-2">{t.spotlight2Title}</h4>
                <p className="text-white/80 text-sm line-clamp-2">{t.spotlight2Desc}</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Map Section */}
        <MapSection 
          events={filteredEvents} 
          onEventClick={(e) => setSelectedEvent(e)} 
          t={t}
        />

        {/* Top Picks Section */}
        <section className="mb-20">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#B56576]/10 text-[#B56576] text-xs font-bold uppercase tracking-widest rounded-full mb-4">
                <Star className="w-3 h-3 fill-current" />
                {t.topPicks}
              </div>
              <h3 className="text-4xl font-serif font-bold text-[#2D4F3E]">{t.topPicks}</h3>
              <p className="text-gray-500 mt-2">{t.topPicksSub}</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.filter(e => e.rating && e.rating >= 4.8).slice(0, 3).map((event) => (
              <EventCard 
                key={event.id} 
                event={event} 
                onClick={setSelectedEvent} 
                t={t} 
                user={user} 
                toggleJoinEvent={toggleJoinEvent} 
              />
            ))}
          </div>
        </section>

        {/* Trending Section */}
        <section className="mb-20">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#C05E41]/10 text-[#C05E41] text-xs font-bold uppercase tracking-widest rounded-full mb-4">
                <TrendingUp className="w-3 h-3" />
                {t.trending}
              </div>
              <h3 className="text-4xl font-serif font-bold text-[#2D4F3E]">{t.trending}</h3>
              <p className="text-gray-500 mt-2">{t.trendingSub}</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...events]
              .sort((a, b) => (b.attendees?.length || 0) - (a.attendees?.length || 0))
              .slice(0, 10)
              .map((event) => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  onClick={setSelectedEvent} 
                  t={t} 
                  user={user} 
                  toggleJoinEvent={toggleJoinEvent} 
                />
              ))}
          </div>
        </section>

        {/* Filters & Search */}
        <div id="community-feed" className="flex flex-col sm:flex-row gap-4 mb-10 items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 w-full sm:w-auto no-scrollbar">
            {[
              { id: 'All', label: t.filters.all },
              { id: 'MakanKaki', label: t.filters.makankaki },
              { id: 'DurianKaki', label: t.kakiTags.duriankaki },
              { id: 'Festival', label: t.filters.festival },
              { id: 'Cultural', label: t.filters.cultural },
              { id: 'Community', label: t.filters.community },
              { id: 'JalanKaki', label: t.filters.jalankaki },
              { id: 'SembangKaki', label: t.filters.sembangkaki },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all",
                  filter === cat.id 
                    ? "bg-[#2D4F3E] text-white shadow-md" 
                    : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D4F3E]/20"
            />
          </div>
        </div>

        {/* Event Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          <AnimatePresence mode="popLayout">
            {filteredEvents.map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <EventCard 
                  event={event} 
                  onClick={setSelectedEvent} 
                  t={t} 
                  user={user} 
                  toggleJoinEvent={toggleJoinEvent} 
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-400">{t.noEvents}</h3>
            <p className="text-gray-400">{t.noEventsSub}</p>
          </div>
        )}
      </main>

      {/* Community Partners Section */}
      <section className="py-24 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div>
              <h2 className="text-4xl font-bold text-[#2D4F3E] tracking-tight mb-4">{t.partners.title}</h2>
              <p className="text-gray-500 max-w-xl text-lg">{t.partners.subtitle}</p>
            </div>
            <button className="px-8 py-4 bg-[#2D4F3E] text-white rounded-2xl font-bold hover:bg-[#1a3026] transition-all shadow-lg hover:shadow-xl flex items-center gap-2 group">
              {t.partners.cta}
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
            {[
              { name: "@hikingwithfriends", handle: "hikingwithfriends" },
              { name: "@rehaus.official", handle: "rehaus.official" },
              { name: "@makanmakan.my", handle: "makanmakan.my" },
              { name: "@kaki_jalan", handle: "kaki_jalan" }
            ].map((partner, idx) => (
              <div key={idx} className="flex flex-col items-center gap-3 p-8 rounded-3xl border border-dashed border-gray-200 hover:border-[#2D4F3E]/30 hover:bg-gray-50 transition-all cursor-pointer group">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-md transition-all">
                  <Instagram className="w-8 h-8 text-gray-400 group-hover:text-pink-600" />
                </div>
                <span className="font-bold text-gray-600 group-hover:text-[#2D4F3E]">{partner.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Flower2 className="w-5 h-5 text-[#C05E41]" />
            <span className="font-bold text-[#2D4F3E]">Kaki</span>
          </div>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            {t.footerText}
          </p>
          <div className="flex justify-center gap-4 mt-8">
            <div className="w-8 h-1 bg-[#C05E41]" />
            <div className="w-8 h-1 bg-[#2D4F3E]" />
            <div className="w-8 h-1 bg-[#E6C9A8]" />
            <div className="w-8 h-1 bg-white border border-gray-200" />
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {isEventModalOpen && (
          <EventModal 
            user={user!} 
            onClose={() => setIsEventModalOpen(false)} 
            t={t}
          />
        )}
        {isProfileModalOpen && user && (
          <ProfileModal 
            user={user} 
            onClose={() => setIsProfileModalOpen(false)} 
            onUpdate={(updated) => setUser(updated)}
            t={t}
          />
        )}
        {selectedEvent && (
          <EventDetailModal 
            event={selectedEvent} 
            user={user}
            onClose={() => setSelectedEvent(null)}
            onJoin={() => toggleJoinEvent(selectedEvent)}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MapSection({ events, onEventClick, t }: { events: KakiEvent[], onEventClick: (e: KakiEvent) => void, t: any }) {
  return (
    <section className="mb-20 -mx-4 sm:-mx-8 lg:-mx-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 mb-8">
        <h3 className="text-3xl font-serif font-bold text-[#2D4F3E]">{t.mapTitle}</h3>
        <p className="text-gray-500">{t.mapSub}</p>
      </div>
      
      <div className="h-[600px] w-full relative z-0 group">
        <div className="absolute inset-0 bg-[#E6C9A8]/10 pointer-events-none z-10 mix-blend-multiply"></div>
        <MapContainer 
          center={[3.1390, 101.6869]} 
          zoom={11} 
          style={{ height: '100%', width: '100%', filter: 'sepia(0.2) contrast(1.1) brightness(1.05)' }}
          scrollWheelZoom={false}
          className="full-width-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {events.map((event) => (
            event.lat && event.lng && (
              <Marker 
                key={event.id} 
                position={[event.lat, event.lng]}
                icon={L.divIcon({
                  html: `<div class="marker-pop w-10 h-10 ${event.category === 'MakanKaki' ? 'bg-[#C05E41]' : 'bg-[#2D4F3E]'} rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white transition-transform hover:scale-125">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                        </div>`,
                  className: '',
                  iconSize: [40, 40],
                  iconAnchor: [20, 40],
                  popupAnchor: [0, -40]
                })}
              >
                <Popup>
                  <div className="p-3 max-w-[220px]">
                    <div className="w-full h-24 rounded-xl overflow-hidden mb-3">
                      <img src={getEventImage(event)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <h4 className="font-bold text-[#2D4F3E] mb-1 text-lg">{event.title}</h4>
                    <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </p>
                    <button 
                      onClick={() => onEventClick(event)}
                      className="w-full py-2 bg-[#2D4F3E] text-white rounded-xl text-xs font-bold hover:bg-[#1D3F2E] transition-colors"
                    >
                      {t.viewDetails}
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
        
        {/* Map Overlay Info */}
        <div className="absolute bottom-8 left-8 z-20 bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-[#E6C9A8]/30 hidden sm:block">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[1,2,3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                  <img src={`https://i.pravatar.cc/100?u=${i}`} alt="" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-[#2D4F3E]">12+ Kaki gatherings nearby</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LocationPicker({ onLocationSelect, initialPos }: { onLocationSelect: (lat: number, lng: number) => void, initialPos?: { lat: number, lng: number } }) {
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  return (
    <div className="h-64 w-full rounded-2xl overflow-hidden border border-gray-200 mb-4 z-0">
      <MapContainer 
        center={initialPos ? [initialPos.lat, initialPos.lng] : [3.1390, 101.6869]} 
        zoom={12} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents />
        {initialPos && (
          <Marker position={[initialPos.lat, initialPos.lng]} icon={KakiIcon} />
        )}
      </MapContainer>
    </div>
  );
}

function EventDetailModal({ event, user, onClose, onJoin, t }: { 
  event: KakiEvent, 
  user: UserProfile | null, 
  onClose: () => void,
  onJoin: () => void,
  t: any
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#2D4F3E]/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-500 hover:text-gray-800 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="overflow-y-auto no-scrollbar">
          <div className="h-80 relative">
            <img 
              src={getEventImage(event)} 
              alt={event.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
              <Leaf className="w-32 h-32 text-white absolute -top-10 -left-10 rotate-45" />
              <Flower2 className="w-48 h-48 text-white absolute -bottom-10 -right-10 -rotate-12" />
            </div>
            <div className="absolute bottom-8 left-8 right-8">
              <div className="flex gap-2 mb-4">
                {event.isPartnerEvent && (
                  <span className="px-4 py-1.5 bg-[#2D4F3E] text-white text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" />
                    {t.partners.verified}
                  </span>
                )}
                <span className="px-4 py-1.5 bg-white text-[#2D4F3E] text-[10px] font-bold uppercase tracking-widest rounded-full">
                  {event.category}
                </span>
                {event.ethnicityTag && (
                  <span className="px-4 py-1.5 bg-[#C05E41] text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                    {event.ethnicityTag}
                  </span>
                )}
              </div>
              <h2 className="text-4xl font-serif font-bold text-white leading-tight">{event.title}</h2>
            </div>
          </div>

          <div className="p-8 sm:p-12">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="md:col-span-2 space-y-8">
                <div>
                  <h3 className="text-xl font-serif font-bold text-[#2D4F3E] mb-4">{t.aboutGathering}</h3>
                  <p className="text-gray-600 leading-relaxed text-lg">
                    {event.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-[#F9F7F2] rounded-3xl border border-[#E6C9A8]/20">
                    <Calendar className="w-6 h-6 text-[#C05E41] mb-3" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t.date}</p>
                    <p className="font-bold text-[#2D4F3E]">{format(new Date(event.date), 'EEEE, MMM d')}</p>
                  </div>
                  <div className="p-6 bg-[#F9F7F2] rounded-3xl border border-[#E6C9A8]/20">
                    <Clock className="w-6 h-6 text-[#2D4F3E] mb-3" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t.time}</p>
                    <p className="font-bold text-[#2D4F3E]">{event.time}</p>
                  </div>
                  <div className="p-6 bg-[#F9F7F2] rounded-3xl border border-[#E6C9A8]/20 col-span-2">
                    <MapPin className="w-6 h-6 text-[#2D4F3E] mb-3" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t.location}</p>
                    <p className="font-bold text-[#2D4F3E] mb-4">{event.location}</p>
                    
                    {event.lat && event.lng && (
                      <div className="h-48 w-full rounded-2xl overflow-hidden border border-[#E6C9A8]/30 z-0">
                        <MapContainer 
                          center={[event.lat, event.lng]} 
                          zoom={15} 
                          style={{ height: '100%', width: '100%' }}
                          dragging={false}
                          zoomControl={false}
                          scrollWheelZoom={false}
                          doubleClickZoom={false}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <Marker position={[event.lat, event.lng]} icon={KakiIcon} />
                        </MapContainer>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="p-8 bg-[#2D4F3E] rounded-[2.5rem] text-white">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-bold">
                      {event.organizerName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider">{t.organizedBy}</p>
                      <p className="text-lg font-bold flex items-center gap-2">
                        {event.organizerName}
                        {event.isPartnerEvent && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </p>
                    </div>
                  </div>

                  {event.instagramLink && (
                    <a 
                      href={event.instagramLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 mb-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all text-sm"
                    >
                      <Instagram className="w-4 h-4" />
                      Instagram
                    </a>
                  )}
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">{t.attendees}</span>
                      <span className="font-bold">{event.attendees.length} {t.joined}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((event.attendees.length / 20) * 100, 100)}%` }}
                        className="h-full bg-[#C05E41]"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={onJoin}
                    disabled={!user}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold transition-all shadow-xl",
                      event.attendees.includes(user?.uid || '')
                        ? "bg-white/10 text-white border border-white/20"
                        : "bg-[#C05E41] text-white hover:bg-[#A04E31] shadow-orange-900/40"
                    )}
                  >
                    {event.attendees.includes(user?.uid || '') ? t.leave : t.join}
                  </button>
                  {!user && (
                    <p className="text-[10px] text-center mt-4 text-white/40 uppercase font-bold tracking-widest">{t.loginToJoin}</p>
                  )}
                </div>

                <div className="text-center">
                  <h4 className="text-sm font-bold text-[#2D4F3E] mb-4">{t.shareWithFriends}</h4>
                  <div className="flex justify-center gap-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border border-[#E6C9A8] flex items-center justify-center text-gray-400 hover:text-[#C05E41] hover:border-[#C05E41] cursor-pointer transition-all">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function OnboardingFlow({ user, onComplete, t }: { user: UserProfile, onComplete: (u: UserProfile) => void, t: any }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    displayName: user.displayName,
    ethnicity: '',
    interests: [] as string[]
  });

  const cultures = Object.keys(t.onboarding.cultures);

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest) 
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleFinish = async () => {
    const updatedUser = { 
      ...user, 
      ...formData, 
      onboardingCompleted: true,
      createdAt: new Date().toISOString() // Ensure createdAt is set for notification logic
    };
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: formData.displayName,
        ethnicity: formData.ethnicity,
        interests: formData.interests,
        onboardingCompleted: true,
        createdAt: new Date().toISOString()
      });
      onComplete(updatedUser);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7F2] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="h-2 bg-gray-100">
          <motion.div 
            className="h-full bg-[#2D4F3E]"
            initial={{ width: '33%' }}
            animate={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-20 h-20 bg-[#E6C9A8]/30 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-3">
                    <Users className="w-10 h-10 text-[#8B4513]" />
                  </div>
                  <h2 className="text-3xl font-serif font-bold text-[#2D4F3E]">{t.onboarding.step1Title}</h2>
                  <p className="text-gray-500 font-medium">{t.onboarding.step1Sub}</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.displayName}</label>
                    <input 
                      type="text" 
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all"
                      value={formData.displayName}
                      onChange={e => setFormData({...formData, displayName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.ethnicityTag}</label>
                    <input 
                      type="text" 
                      placeholder={t.ethnicityTagPlaceholder}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all"
                      value={formData.ethnicity}
                      onChange={e => setFormData({...formData, ethnicity: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  onClick={() => setStep(2)}
                  disabled={!formData.displayName || !formData.ethnicity}
                  className="nature-button w-full bg-[#2D4F3E] text-white shadow-xl shadow-green-900/20 disabled:opacity-50"
                >
                  {t.onboarding.continue}
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-20 h-20 bg-[#C05E41]/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 -rotate-3">
                    <Search className="w-10 h-10 text-[#C05E41]" />
                  </div>
                  <h2 className="text-3xl font-serif font-bold text-[#2D4F3E]">{t.onboarding.step2Title}</h2>
                  <p className="text-gray-500 font-medium">{t.onboarding.step2Sub}</p>
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  {cultures.map(culture => (
                    <button
                      key={culture}
                      onClick={() => toggleInterest(culture)}
                      className={cn(
                        "px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300",
                        formData.interests.includes(culture)
                          ? "bg-[#C05E41] text-white shadow-lg shadow-orange-900/20 scale-105"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {t.onboarding.cultures[culture as keyof typeof t.onboarding.cultures]}
                    </button>
                  ))}
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
                  >
                    {t.onboarding.back}
                  </button>
                  <button 
                    onClick={() => setStep(3)}
                    disabled={formData.interests.length === 0}
                    className="flex-[2] py-4 bg-[#2D4F3E] text-white font-bold rounded-2xl shadow-lg shadow-green-900/20 disabled:opacity-50"
                  >
                    {t.onboarding.next}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 text-center"
              >
                <div className="w-24 h-24 bg-green-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 rotate-6 shadow-inner">
                  <Heart className="w-12 h-12 text-green-600 fill-current" />
                </div>
                <div>
                  <h2 className="text-3xl font-serif font-bold text-[#2D4F3E] mb-3">{t.onboarding.step3Title}</h2>
                  <p className="text-gray-600 leading-relaxed font-medium">
                    {t.onboarding.step3Sub} <span className="text-[#C05E41] font-bold">{formData.interests.slice(0, 2).map(i => t.onboarding.cultures[i as keyof typeof t.onboarding.cultures]).join(' & ')}</span> 
                    {formData.interests.length > 2 && ` ${t.onboarding.andMore.replace('{count}', (formData.interests.length - 2).toString())}`}.
                  </p>
                </div>

                <button 
                  onClick={handleFinish}
                  className="nature-button w-full bg-[#C05E41] text-white shadow-2xl shadow-orange-900/30"
                >
                  {t.onboarding.finish}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function EventModal({ user, onClose, t }: { user: UserProfile, onClose: () => void, t: any }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    lat: 3.1390,
    lng: 101.6869,
    date: '',
    time: '',
    category: 'Community' as KakiEvent['category'],
    kakiTag: '',
    ethnicityTag: '',
    religionTag: '',
    price: 0,
    capacity: 20,
    isPartnerEvent: false,
    instagramLink: '',
    imageUrl: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    const path = 'events';
    
    try {
      console.log('Attempting to create event with data:', formData);
      await addDoc(collection(db, path), {
        ...formData,
        organizerId: user.uid,
        organizerName: user.displayName,
        attendees: [user.uid],
        rating: 5.0,
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (error: any) {
      console.error('Detailed Firestore Error:', error);
      setSubmitError(error.message || 'Failed to create event. Please try again.');
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-auto md:max-h-[85vh]"
      >
        {/* Left Side: Visual & Tips */}
        <div className="hidden md:flex md:w-5/12 bg-[#2D4F3E] p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#E6C9A8]/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#C05E41]/10 rounded-full -ml-32 -mb-32 blur-3xl" />
          
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8">
              <Plus className="w-8 h-8 text-[#E6C9A8]" />
            </div>
            <h2 className="text-5xl font-serif font-bold text-white leading-tight mb-6">
              Host your <span className="text-[#E6C9A8]">Kaki</span> Gathering
            </h2>
            <p className="text-[#E6C9A8]/80 text-lg leading-relaxed font-medium">
              Bring your neighborhood together. Whether it's a simple potluck or a festive celebration, every gathering strengthens our community bond.
            </p>
          </div>

          <div className="relative z-10">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-white/5 border border-white/10 mb-6 group relative">
              {formData.imageUrl ? (
                <img 
                  src={formData.imageUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#E6C9A8]/40 p-8 text-center">
                  <Camera className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest">Image Preview</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#E6C9A8]/20 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-[10px] font-bold text-[#E6C9A8]">01</span>
                </div>
                <p className="text-white/70 text-sm">Use a clear, vibrant photo to attract more Kakis.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#E6C9A8]/20 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-[10px] font-bold text-[#E6C9A8]">02</span>
                </div>
                <p className="text-white/70 text-sm">Be specific about the location to help people find you.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#F9F7F2]">
          <div className="p-6 md:p-8 border-b border-[#E6C9A8]/20 flex items-center justify-between bg-white md:bg-transparent">
            <div className="md:hidden flex items-center gap-3">
              <Plus className="w-6 h-6 text-[#C05E41]" />
              <h3 className="text-xl font-serif font-bold text-[#2D4F3E]">{t.createEvent}</h3>
            </div>
            <div className="hidden md:block">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{t.hostButton}</p>
              <h3 className="text-2xl font-serif font-bold text-[#2D4F3E]">Gathering Details</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="flex-1 p-6 md:p-8 space-y-8 overflow-y-auto no-scrollbar">
            <div className="space-y-6">
              {/* Basic Info Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#C05E41] uppercase tracking-widest border-b border-[#C05E41]/10 pb-2">Basic Information</h4>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.eventTitle}</label>
                  <input 
                    required
                    type="text" 
                    placeholder={t.eventTitlePlaceholder}
                    className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all font-medium"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.eventPhotoUrl}</label>
                  <div className="relative">
                    <Camera className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="url" 
                      placeholder={t.eventPhotoPlaceholder}
                      className="w-full pl-14 pr-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all font-medium"
                      value={formData.imageUrl}
                      onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.eventDate}</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all font-medium"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.eventTime}</label>
                    <input 
                      required
                      type="text" 
                      placeholder={t.eventTimePlaceholder}
                      className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all font-medium"
                      value={formData.time}
                      onChange={e => setFormData({...formData, time: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Location Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#C05E41] uppercase tracking-widest border-b border-[#C05E41]/10 pb-2">Location</h4>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.eventLocation}</label>
                  <div className="relative mb-4">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      required
                      type="text" 
                      placeholder={t.eventLocationPlaceholder}
                      className="w-full pl-14 pr-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all font-medium"
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                  <div className="rounded-3xl overflow-hidden border border-gray-200 shadow-inner">
                    <LocationPicker 
                      onLocationSelect={(lat, lng) => setFormData({...formData, lat, lng})}
                      initialPos={{ lat: formData.lat, lng: formData.lng }}
                    />
                  </div>
                </div>
              </div>

              {/* Classification Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#C05E41] uppercase tracking-widest border-b border-[#C05E41]/10 pb-2">Classification</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.eventCategory}</label>
                    <select 
                      className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all appearance-none font-medium"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value as KakiEvent['category']})}
                    >
                      <option value="MakanKaki">{t.filters.makankaki}</option>
                      <option value="Festival">{t.filters.festival}</option>
                      <option value="Cultural">{t.filters.cultural}</option>
                      <option value="Community">{t.filters.community}</option>
                      <option value="Religious">{t.filters.religious}</option>
                      <option value="JalanKaki">{t.filters.jalankaki}</option>
                      <option value="SembangKaki">{t.filters.sembangkaki}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.kakiTag}</label>
                    <select 
                      className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all appearance-none font-medium"
                      value={formData.kakiTag}
                      onChange={e => setFormData({...formData, kakiTag: e.target.value})}
                    >
                      <option value="">None</option>
                      <option value="DurianKaki">{t.kakiTags.duriankaki}</option>
                      <option value="JalanKaki">{t.kakiTags.jalankaki}</option>
                      <option value="SembangKaki">{t.kakiTags.sembangkaki}</option>
                      <option value="MakanKaki">{t.kakiTags.makankaki}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.ethnicityTag}</label>
                    <input 
                      type="text" 
                      placeholder={t.ethnicityTagPlaceholder}
                      className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all font-medium"
                      value={formData.ethnicityTag}
                      onChange={e => setFormData({...formData, ethnicityTag: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.religionTag}</label>
                    <input 
                      type="text" 
                      placeholder={t.religionTagPlaceholder}
                      className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all font-medium"
                      value={formData.religionTag}
                      onChange={e => setFormData({...formData, religionTag: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Logistics Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#C05E41] uppercase tracking-widest border-b border-[#C05E41]/10 pb-2">Logistics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Price (RM)</label>
                    <input 
                      required
                      type="number" 
                      min="0"
                      className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all font-medium"
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Capacity</label>
                    <input 
                      required
                      type="number" 
                      min="1"
                      className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all font-medium"
                      value={formData.capacity}
                      onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="p-6 bg-white rounded-[2rem] border border-[#E6C9A8]/30 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#2D4F3E]">{t.partners.verified}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Mark this as a community partner event</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, isPartnerEvent: !formData.isPartnerEvent})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        formData.isPartnerEvent ? "bg-[#2D4F3E]" : "bg-gray-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                        formData.isPartnerEvent ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>
                  
                  {formData.isPartnerEvent && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="pt-4 border-t border-gray-100"
                    >
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Instagram Link</label>
                      <div className="relative">
                        <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-600" />
                        <input 
                          type="url" 
                          placeholder="https://instagram.com/..."
                          className="w-full pl-11 pr-5 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all text-sm font-medium"
                          value={formData.instagramLink}
                          onChange={e => setFormData({...formData, instagramLink: e.target.value})}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Description Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#C05E41] uppercase tracking-widest border-b border-[#C05E41]/10 pb-2">Description</h4>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.eventDescription}</label>
                  <textarea 
                    required
                    rows={4}
                    placeholder={t.eventDescriptionPlaceholder}
                    className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#2D4F3E]/10 outline-none transition-all resize-none font-medium"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                  <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                  {submitError}
                </div>
              )}
              <button 
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "nature-button w-full bg-[#C05E41] text-white shadow-2xl shadow-orange-900/30 py-6 text-lg flex items-center justify-center gap-3 transition-all",
                  isSubmitting && "opacity-80 cursor-not-allowed scale-[0.98]"
                )}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating your gathering...</span>
                  </>
                ) : (
                  t.create
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProfileModal({ user, onClose, onUpdate, t }: { user: UserProfile, onClose: () => void, onUpdate: (u: UserProfile) => void, t: any }) {
  const [formData, setFormData] = useState({
    ethnicity: user.ethnicity || '',
    religion: user.religion || '',
    bio: user.bio || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser = { ...user, ...formData };
    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), formData);
      onUpdate(updatedUser);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-8 bg-[#E6C9A8] text-[#8B4513] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-serif font-bold">{t.profileTitle}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <p className="text-sm text-[#8B4513]/70 font-medium leading-relaxed">
            {t.profileDesc}
          </p>
          
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.ethnicityTag}</label>
              <input 
                type="text" 
                placeholder={t.ethnicityTagPlaceholder}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#E6C9A8]/20 outline-none transition-all"
                value={formData.ethnicity}
                onChange={e => setFormData({...formData, ethnicity: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.religionTag}</label>
              <input 
                type="text" 
                placeholder={t.religionTagPlaceholder}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#E6C9A8]/20 outline-none transition-all"
                value={formData.religion}
                onChange={e => setFormData({...formData, religion: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.bio}</label>
              <textarea 
                rows={3}
                placeholder={t.bioPlaceholder}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#E6C9A8]/20 outline-none transition-all resize-none"
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
              />
            </div>
          </div>

          <button 
            type="submit"
            className="nature-button w-full bg-[#2D4F3E] text-white shadow-2xl shadow-green-900/30"
          >
            {t.saveProfile}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
