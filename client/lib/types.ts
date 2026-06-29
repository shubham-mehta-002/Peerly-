// ─── UI Preferences ──────────────────────────────────────────────────────────

export type CardLayout = 'open' | 'bordered' | 'filled';
export type AnonStyle = 'badge' | 'inline' | 'ghost';
export type AccentColor = 'sage' | 'navy' | 'terra';

export interface TweaksState {
  cardLayout: CardLayout;
  anonStyle: AnonStyle;
  accentColor: AccentColor;
  setCardLayout: (v: CardLayout) => void;
  setAnonStyle: (v: AnonStyle) => void;
  setAccentColor: (v: AccentColor) => void;
}

// ─── Shared Error Shape ───────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  response?: { data?: { error?: string } };
}

// ─── Auth Responses ───────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  onboarding_completed: boolean;
}

export interface VerifyEmailResponse {
  accessToken: string;
  refreshToken: string;
  onboarding_completed: boolean;
}

export interface OnboardingProfile {
  name: string;
  username: string;
  bio: string | null;
  campus_id: string;
  onboarding_completed: boolean;
  avatar_url: string | null;
  updated_at: string;
}

export interface OnboardingCompleteResponse {
  accessToken: string;
  refreshToken: string;
  profile: OnboardingProfile;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminCollegeResponse {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive';
  campus_count: number;
}

// ─── Communities ──────────────────────────────────────────────────────────────

export interface CommunityResponse {
  id: string;
  name: string;
  description: string;
  member_count: number;
  category: string;
  is_member: boolean;
}

export interface CommunityMessageResponse {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  created_at: string;
  is_anon: boolean;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface CommentResponse {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  upvotes: number;
  depth: number;
  created_at: string;
  is_anon: boolean;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface ReportResponse {
  id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

// ─── Sample data types (legacy, kept for data.ts compatibility) ───────────────

export interface SamplePost {
  id: number;
  author: string;
  anon: boolean;
  time: string;
  content: string;
  upvotes: number;
  comments: number;
  hasImage: boolean;
  trending: boolean;
  global: boolean;
}

export interface SampleCommunity {
  id: number;
  name: string;
  desc: string;
  members: number;
  category: string;
  active?: boolean;
}

export interface SampleMessage {
  id: number;
  author: string;
  text: string;
  time: string;
  mine: boolean;
}

export interface SampleComment {
  id: number;
  author: string;
  anon: boolean;
  time: string;
  text: string;
  upvotes: number;
  depth: number;
}
