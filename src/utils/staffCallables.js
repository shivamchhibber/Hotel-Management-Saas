import { httpsCallable } from "firebase/functions";
import { functions, HTTPS_CALLABLE_LONG_TIMEOUT_MS } from "../firebase/config";

const opts = { timeout: HTTPS_CALLABLE_LONG_TIMEOUT_MS };

/** Admin-backed list ops for hotel_staff (bypass fragile Firestore list-query rules). */
export const staffListRoomsFn = httpsCallable(functions, "staffListRooms", opts);
export const staffListGuestsFn = httpsCallable(functions, "staffListGuests", opts);
export const staffListMyStaffActionsFn = httpsCallable(functions, "staffListMyStaffActions", opts);
export const staffUpdateRoomFn = httpsCallable(functions, "staffUpdateRoom", opts);
export const staffLookupGuestProfileFn = httpsCallable(functions, "staffLookupGuestProfile", opts);
