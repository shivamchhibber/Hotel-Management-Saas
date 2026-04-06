import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../../firebase/config";
import InputField from "components/fields/InputField";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "contexts/AuthContext";
import { normalizeRole } from "utils/roleUtils";

function routeForRole(role) {
  switch (normalizeRole(role)) {
    case "super_admin":
      return "/super-admin/dashboard";
    case "hotel_owner":
      return "/hotel-owner/dashboard";
    case "hotel_staff":
      return "/hotel-staff/profile";
    case "guest":
      return "/guest/my-stays";
    default:
      return "/";
  }
}

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authMethod, setAuthMethod] = useState("email");

  const { login, loginWithGoogle, loginWithPhone, verifyPhoneOTP, currentUser, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !currentUser || !userRole) return;
    navigate(routeForRole(userRole), { replace: true });
  }, [currentUser, userRole, authLoading, navigate]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError("Failed to sign in: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle();
    } catch (err) {
      setError("Failed to sign in with Google: " + err.message);
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const fullPhoneNumber = `+91${phoneNumber}`;
      const appVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => {},
      });
      const result = await loginWithPhone(fullPhoneNumber, appVerifier);
      setConfirmationResult(result);
      setShowOtp(true);
    } catch (err) {
      setError("Failed to send OTP: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerification = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyPhoneOTP(confirmationResult, otp);
    } catch (err) {
      setError("Failed to verify OTP: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-16 mb-16 flex h-full w-full items-center justify-center px-2 md:mx-0 md:px-0 lg:mb-10 lg:items-center lg:justify-start">
      <div className="mt-[10vh] w-full max-w-full flex-col items-center md:pl-4 lg:pl-0 xl:max-w-[420px]">
        <h4 className="mb-2.5 text-4xl font-bold text-navy-700 dark:text-white">Sign In</h4>
        <p className="mb-9 ml-1 text-base text-gray-600 dark:text-white">Use your registered credentials</p>

        {error && (
          <div className="mb-4 w-full rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-200">{error}</div>
        )}

        <div className="mb-6 flex rounded-lg bg-gray-100 p-1 dark:bg-navy-800">
          {["email", "phone"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setAuthMethod(m)}
              className={`flex-1 rounded-md py-2 text-sm font-medium capitalize ${
                authMethod === m ? "bg-white text-brand-500 shadow-sm dark:bg-navy-700 dark:text-white" : "text-gray-600"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {authMethod === "email" && (
          <>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="mb-6 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-lightPrimary dark:bg-navy-800 disabled:opacity-50"
            >
              <FcGoogle className="text-xl" />
              <span className="text-sm font-medium text-navy-700 dark:text-white">Sign in with Google</span>
            </button>
            <form onSubmit={handleEmailLogin}>
              <InputField
                variant="auth"
                extra="mb-3"
                label="Email*"
                placeholder="mail@example.com"
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <InputField
                variant="auth"
                extra="mb-3"
                label="Password*"
                placeholder="Min. 8 characters"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </>
        )}

        {authMethod === "phone" && !showOtp && (
          <form onSubmit={handlePhoneLogin}>
            <InputField
              variant="auth"
              extra="mb-3"
              label="Phone Number*"
              placeholder="9876543210"
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
            <div id="recaptcha-container" />
            <button
              type="submit"
              disabled={loading}
              className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? "Sending OTP…" : "Send OTP"}
            </button>
          </form>
        )}

        {authMethod === "phone" && showOtp && (
          <form onSubmit={handleOtpVerification}>
            <InputField
              variant="auth"
              extra="mb-3"
              label="Enter OTP*"
              placeholder="123456"
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify OTP"}
            </button>
          </form>
        )}

        <div className="mt-4 text-sm text-navy-700 dark:text-gray-400">
          Need an account?{" "}
          <Link to="/auth/sign-up" className="font-medium text-brand-500 hover:text-brand-600">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
