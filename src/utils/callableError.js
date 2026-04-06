/**
 * Human-readable message for Firebase Callable failures.
 * Browsers often report wrong-region / missing deploy / blocked responses as "CORS" or "internal".
 */

function stringifyExtra(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function extractCallableExtras(error) {
    if (!error || typeof error !== "object") return "";
    const parts = [];
    if (error.details != null) parts.push(stringifyExtra(error.details));
    if (error.customData != null) parts.push(stringifyExtra(error.customData));
    return parts.filter(Boolean).join(" | ");
}

export function formatCallableError(error, operationLabel = "") {
    const code = String(error?.code || "");
    const msg = String(error?.message || error || "");
    const extras = extractCallableExtras(error);
    const custom =
        error?.customData && typeof error.customData === "object"
            ? String(error.customData.message || "")
            : "";

    const combined = [code && code !== "unknown" ? code : "", msg, extras, custom]
        .filter(Boolean)
        .join(" — ");

    const lower = `${msg} ${code} ${extras}`.toLowerCase();
    const looksNetworkOrCors =
        lower.includes("cors") ||
        lower.includes("network error") ||
        lower.includes("failed to fetch") ||
        lower.includes("load failed") ||
        lower.includes("networkerror");

    if (looksNetworkOrCors || code === "functions/internal") {
        const internalExplain =
            code === "functions/internal"
                ? "\n\nWhat \"internal\" means: the app did not receive a specific error from your function — only a generic failure. That is different from \"owner email not in Auth\". The real cause is almost always in Cloud Functions logs or the Network response JSON."
                : "";
        const hint =
            "Cloud Functions request failed (browsers often label this as CORS). Check: (1) firebase deploy --only functions succeeded; (2) REACT_APP_FIREBASE_FUNCTIONS_REGION matches deploy region (us-central1); (3) REACT_APP_FIREBASE_PROJECT_ID matches the project where you sign in; (4) sign out and back in (fresh ID token); (5) Firebase Console → App Check: if enforcement is on for Functions, add App Check to the web app or disable enforcement for dev; (6) DevTools → Network → find the callable POST → Response tab; (7) Functions → Logs for the stack trace.";
        const body = operationLabel
            ? `${operationLabel}${internalExplain}\n\n${hint}\n\nTechnical: ${combined || msg}`
            : `${internalExplain}\n\n${hint}\n\nTechnical: ${combined || msg}`;
        return body.replace(/^\n+/, "");
    }

    return combined || msg || "Request failed";
}
