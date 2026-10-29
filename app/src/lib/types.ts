export type LatLng = { latitude: number; longitude: number };

export type Place = LatLng & { name: string; address?: string };

/** Route options every routing provider understands. */
export type Avoid = { highways: boolean; tolls: boolean };

/** A route as stored with a ride: Google-encoded polyline (precision 5) plus totals. */
export type Route = { polyline: string; distanceM: number; durationS: number };

/**
 * One turn. `maneuver` uses the Google Routes names (TURN_LEFT, ROUNDABOUT_RIGHT, …, see
 * components/nav/maneuver.ts); other providers map their types onto them.
 */
export type RouteStep = { instruction: string; maneuver: string; distanceM: number };

export type RouteWithSteps = Route & { steps: RouteStep[] };

/** A place-search result. OpenStreetMap results carry the place; Google needs a details call. */
export type Suggestion = { id: string; main: string; secondary: string; place?: Place };

export type RiderStatus =
  | 'riding'
  | 'fuel'
  | 'rest'
  | 'food'
  | 'mechanical'
  | 'sos'
  | 'arrived'
  | 'left';

export type RiderRole = 'lead' | 'sweep' | null;

export type RideMeta = {
  code: string;
  destination: Place;
  route: Route | null;
  avoid: Avoid;
  createdAt: number;
  createdBy: string;
  lastActivityAt: number;
  locked: boolean;
  endedAt: number | null;
};

export type Member = {
  name: string;
  phone: string | null;
  color: string;
  role: RiderRole;
  status: RiderStatus;
  joinedAt: number;
};

export type RiderLocation = {
  lat: number;
  lng: number;
  speed: number; // m/s, -1 if unknown
  heading: number;
  ts: number;
  alongM: number | null; // distance travelled along the group route
  offRoute: boolean;
};

export type RideEventType =
  | 'joined'
  | 'left'
  | 'sos'
  | 'sos_clear'
  | 'off_route'
  | 'back_on_route'
  | 'arrived'
  | 'status'
  | 'regroup'
  | 'locked';

export type RideEvent = {
  type: RideEventType;
  uid: string;
  ts: number;
  data?: Record<string, string | number | boolean | null>;
};

export type Regroup = { lat: number; lng: number; label: string; setBy: string; ts: number };

export type Profile = { name: string; phone: string; sharePhone: boolean };

/** The signed-in Firebase user, platform-independent. */
export type AppUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  /** E.164, set once the phone number has been verified by OTP and linked to the account. */
  phoneNumber: string | null;
  displayName: string | null;
  /** e.g. "google.com", "password", "phone". */
  providers: string[];
};
