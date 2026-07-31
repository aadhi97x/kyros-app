/**
 * Response shapes from kyros-web.
 *
 * Hand-maintained rather than generated, because the two repositories ship
 * independently — a generated client would couple their release cycles. Keep
 * these in step with `src/app/api/v1/**` in kyros-web.
 */

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthAccount {
  id: string;
  name: string;
  phone: string;
  role: 'MEMBER' | 'CLUB_OWNER' | 'COACH' | 'VENUE_OWNER' | 'PLATFORM_ADMIN';
  type: 'GUARDIAN' | 'ADULT_PLAYER' | 'UNSET';
  needsAccountType: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  account: AuthAccount;
}

export interface OtpChallenge {
  challengeId: string;
  expiresAt: string;
  /** Present only while the API runs in dev mode. */
  devCode?: string;
}

export interface SignupResponse {
  accountId: string;
  requiresClaim: boolean;
  otp: OtpChallenge;
  message?: string;
}

// ---------------------------------------------------------------------------
// Players & consent
// ---------------------------------------------------------------------------

export interface PlayerConsentSummary {
  required: boolean;
  satisfied: boolean;
  activeScopes: string[];
  missingRequiredScopes: string[];
  grantedAt: string | null;
}

export interface PlayerProfile {
  id: string;
  fullName: string;
  dateOfBirth: string;
  ageYears: number;
  gender: string;
  photoUrl: string | null;
  positions: string[];
  preferredFoot: string | null;
  isMinor: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  joinDate: string;
  consent: PlayerConsentSummary;
  memberships: Array<{
    id: string;
    status: string;
    batch: { id: string; name: string; club: { id: string; name: string } };
  }>;
}

export interface ConsentPurpose {
  scope: string;
  label: string;
  explanation: string;
  required: boolean;
  dataCollected: string[];
  retention: string;
}

export interface ConsentScreenData {
  status: PlayerConsentSummary & { recordId: string | null; verificationMethod: string | null };
  noticeVersion: string;
  purposes: ConsentPurpose[];
  verificationMethod: string;
}

export interface VerificationStart {
  method: 'DIGILOCKER' | 'MOCK' | 'MANUAL_OFFLINE';
  requestId: string;
  redirectUrl: string | null;
  instruction: string | null;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface CatalogCard {
  batchId: string;
  batchName: string;
  clubId: string;
  clubName: string;
  clubLogoUrl: string | null;
  centreId: string;
  centreName: string;
  city: string;
  distanceKm: number | null;
  mode: 'ACADEMY' | 'CREDITS';
  batchType: string;
  skillLevel: string;
  minAge: number;
  maxAge: number;
  capacity: number;
  spotsLeft: number;
  hasSpace: boolean;
  fromPricePaise: number | null;
  billingType: string | null;
  rating: number;
  ratingCount: number;
  schedule: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>;
  amenities: string[];
  callToAction: 'BOOK_DEMO' | 'START_TRIAL' | 'ENROLL';
}

/** The member-facing slice of a club's config — see spec 3.2. */
export interface MemberFacingConfig {
  demoEnabled: boolean;
  demoFeePaise: number;
  demoRequiredBeforeEnrollment: boolean;
  demoBookingWindowDays: number;
  demoMinNoticeHours: number;
  batchAssignment: 'COACH_ASSIGNED' | 'MEMBER_SELF_SELECT';
  memberPicksBatch: boolean;
  approvalRequired: boolean;
  trialClassEnabled: boolean;
  trialClassCount: number;
  waitlistEnabled: boolean;
  partPaymentAllowed: boolean;
  partPaymentSplits: number;
  partPaymentUpfrontBps: number;
  chatEnabled: boolean;
  batchChatEnabled: boolean;
  directChatEnabled: boolean;
  pauseAllowed: boolean;
  pauseMinDays: number;
  pauseMaxDaysPerYear: number;
  pauseNoticeDays: number;
  pauseAcceptedReasons: string[];
  carryover: 'CARRYOVER_CREDIT' | 'ADJUST_NEXT_MONTH' | 'NEITHER';
  refundIfNeverAttended: boolean;
  neverAttendedWindowDays: number;
  cancellationNoticeDays: number;
  registrationFeeRefundable: boolean;
  parentVerificationMethod: string;
}

export interface PackageAddOn {
  id: string;
  name: string;
  pricePaise: number;
  mandatory: boolean;
  oneTime: boolean;
}

export interface ClubPackage {
  id: string;
  tierName: string;
  description: string | null;
  mode: 'ACADEMY' | 'CREDITS';
  billingType: string;
  pricePaise: number;
  registrationFeePaise: number;
  creditSessions: number | null;
  termMonths: number | null;
  inclusions: string[];
  partPaymentAllowed: boolean;
  addOns: PackageAddOn[];
}

export interface ClubBatch {
  id: string;
  name: string;
  mode: 'ACADEMY' | 'CREDITS';
  type: string;
  minAge: number;
  maxAge: number;
  skillLevel: string;
  capacity: number;
  activeCount: number;
  spotsLeft: number;
  entryRules: string | null;
  schedule: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>;
  coach: { id: string; name: string; photoUrl: string | null; qualification: string | null } | null;
  centre: { id: string; name: string };
  packages: ClubPackage[];
}

export interface ClubDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  rating: number;
  ratingCount: number;
  trainingMode: string;
  centres: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
    amenities: string[];
  }>;
  batches: ClubBatch[];
  config: MemberFacingConfig;
  callToAction: 'BOOK_DEMO' | 'START_TRIAL' | 'ENROLL';
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export type EnrollmentStep =
  | 'CONSENT_REQUIRED'
  | 'BOOK_DEMO'
  | 'AWAITING_DEMO'
  | 'AWAITING_DEMO_FEEDBACK'
  | 'POST_DEMO_REVIEW'
  | 'AWAITING_BATCH_ASSIGNMENT'
  | 'SELECT_BATCH'
  | 'SELECT_PACKAGE'
  | 'AGE_BAND_MISMATCH'
  | 'OFFER_WAITLIST'
  | 'CAPACITY_BLOCKED'
  | 'WAITLISTED'
  | 'TRIAL_AVAILABLE'
  | 'PAYMENT'
  | 'PAYMENT_INSTALMENTS_PENDING'
  | 'AWAITING_APPROVAL'
  | 'REJECTED'
  | 'ACTIVE';

export type EnrollmentAction =
  | 'GRANT_CONSENT'
  | 'BOOK_DEMO'
  | 'CANCEL_DEMO'
  | 'ACKNOWLEDGE_DEMO_REVIEW'
  | 'SELECT_BATCH'
  | 'SELECT_PACKAGE'
  | 'CHANGE_BATCH'
  | 'JOIN_WAITLIST'
  | 'DECLINE_WAITLIST'
  | 'LEAVE_WAITLIST'
  | 'START_TRIAL'
  | 'SKIP_TRIAL'
  | 'PAY_FULL'
  | 'PAY_INSTALMENT'
  | 'CONTACT_CLUB'
  | 'BROWSE_OTHER_BATCHES'
  | 'NONE';

export interface EnrollmentDecision {
  step: EnrollmentStep;
  reason: string;
  completed: EnrollmentStep[];
  availableActions: EnrollmentAction[];
  terminal: boolean;
  remainingSteps: EnrollmentStep[];
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

export interface MembershipPolicies {
  pauseAllowed: boolean;
  pauseMinDays: number;
  pauseMaxDaysPerYear: number;
  pauseNoticeDays: number;
  pauseAcceptedReasons: string[];
  carryover: string;
  cancellationNoticeDays: number;
  refundIfNeverAttended: boolean;
}

export interface Membership {
  id: string;
  status:
    | 'PENDING_APPROVAL'
    | 'PENDING_PAYMENT'
    | 'ACTIVE'
    | 'WAITLISTED'
    | 'PAUSED'
    | 'CANCELLED'
    | 'EXPIRED';
  startDate: string | null;
  endDate: string | null;
  totalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  isPartPayment: boolean;
  creditsRemaining: number | null;
  package: { id: string; tierName: string; pricePaise: number; billingType: string };
  batch: { id: string; name: string; mode: string; centre: { id: string; name: string; city: string } };
  club: { id: string; name: string; logoUrl: string | null };
  instalments: Array<{
    id: string;
    sequence: number;
    amountPaise: number;
    dueDate: string;
    paidAt: string | null;
    overdue: boolean;
  }>;
  pauseHistory: Array<{ id: string; startDate: string; endDate: string; reason: string }>;
  policies: MembershipPolicies;
}

export interface MembershipsResponse {
  walletBalancePaise: number;
  players: Array<{
    id: string;
    fullName: string;
    photoUrl: string | null;
    memberships: Membership[];
  }>;
}

// ---------------------------------------------------------------------------
// Coach
// ---------------------------------------------------------------------------

export interface RosterEntry {
  playerProfileId: string;
  fullName: string;
  photoUrl: string | null;
  positions: string[];
  medicalNotes: string | null;
  membershipStatus: string;
  currentMark: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null;
}

export interface CoachSession {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  syllabusModule: string | null;
  notes: string | null;
  batch: { id: string; name: string; mode: string };
  club: { id: string; name: string };
  centre: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    geofenceRadiusM: number;
  };
  attendanceComplete: boolean;
  roster: RosterEntry[];
}

// ---------------------------------------------------------------------------
// Demos & chat
// ---------------------------------------------------------------------------

export interface DemoSlotsResponse {
  demoEnabled: boolean;
  feePaise?: number;
  requiredBeforeEnrollment?: boolean;
  slots: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    placesLeft: number;
    centre: { id: string; name: string; address: string; city: string };
  }>;
}

export interface ChatThread {
  id: string;
  type: 'BATCH_GROUP' | 'DIRECT';
  title: string;
  club: { id: string; name: string; logoUrl: string | null };
  batch: { id: string; name: string } | null;
  myRole: string;
  muted: boolean;
  unreadCount: number;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderAccount: { id: string; name: string };
  } | null;
}

export interface ChatMessage {
  id: string;
  body: string;
  attachmentUrl: string | null;
  createdAt: string;
  senderAccount: { id: string; name: string };
}
