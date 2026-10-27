/**
 * Realtime Database functions. Same names and signatures on every platform: React Native Firebase
 * here (Android/iOS), the Firebase JS SDK in db.web.ts.
 */
export {
  get,
  limitToLast,
  onChildAdded,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
  startAt,
  update,
} from '@react-native-firebase/database';

export { db } from './firebase';
