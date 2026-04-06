import { httpsCallable } from "firebase/functions";
import { functions, HTTPS_CALLABLE_LONG_TIMEOUT_MS } from "../firebase/config";

const opts = { timeout: HTTPS_CALLABLE_LONG_TIMEOUT_MS };

/** Admin-backed list for hotel_owner when client Firestore queries miss Reference-typed hotelId. */
export const ownerListRoomsFn = httpsCallable(functions, "ownerListRooms", opts);
export const ownerListGuestsFn = httpsCallable(functions, "ownerListGuests", opts);
export const ownerListStaysFn = httpsCallable(functions, "ownerListStays", opts);
