export type LatLng = { latitude: number; longitude: number };

export type Place = LatLng & { name: string; address?: string };

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
  route: { polyline: string; distanceM: number; durationS: number } | null;
  avoid: { highways: boolean; tolls: boolean };
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
