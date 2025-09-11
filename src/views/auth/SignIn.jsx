import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../../firebase/config";
import InputField from "components/fields/InputField";
import { FcGoogle } from "react-icons/fc";
import { FaPhone } from "react-icons/fa";
import Checkbox from "components/checkbox";
import { useAuth } from "contexts/AuthContext";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authMethod, setAuthMethod] = useState("email"); // email, phone
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { login, loginWithGoogle, loginWithPhone, verifyPhoneOTP, currentUser, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('SignIn useEffect triggered:', {
      currentUser: currentUser ? currentUser.email : 'null',
      userRole,
      loading,
      isRedirecting
    });

    if (currentUser && userRole && !loading && !isRedirecting) {
      console.log('User authenticated:', currentUser.email);
      console.log('User role:', userRole);

      setIsRedirecting(true);

      // Redirect based on user role
      const redirectUser = () => {
        console.log('About to redirect to:', userRole);
        switch (userRole) {
          case 'super-admin':
            console.log('Redirecting to Super Admin dashboard');
            navigate('/super-admin/dashboard', { replace: true });
            break;
          case 'hotel-owner':
            console.log('Redirecting to Hotel Owner dashboard');
            navigate('/hotel-owner/dashboard', { replace: true });
            break;
          case 'hotel-staff':
            console.log('Redirecting to Hotel Staff dashboard');
            navigate('/hotel-staff/rooms', { replace: true });
            break;
          case 'guest':
            console.log('Redirecting to Guest dashboard');
            navigate('/guest/my-stays', { replace: true });
            break;
          default:
            console.log('Unknown role, redirecting to home');
            navigate('/', { replace: true });
        }
      };

      // Add a small delay to prevent rapid redirects
      const timeoutId = setTimeout(redirectUser, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [currentUser, userRole, loading, isRedirecting, navigate]);

  // Additional useEffect to handle immediate redirect if user is already authenticated
  useEffect(() => {
    if (currentUser && !loading && !isRedirecting) {
      console.log('User already authenticated on page load:', currentUser.email);
      console.log('Current userRole:', userRole);

      // If we have a user but no role yet, wait a bit for the role to be fetched
      if (!userRole) {
        console.log('Waiting for user role to be fetched...');
        return;
      }

      // If we have both user and role, redirect immediately
      if (userRole) {
        console.log('Redirecting immediately for already authenticated user');
        setIsRedirecting(true);

        const redirectUser = () => {
          console.log('About to redirect to:', userRole);
          switch (userRole) {
            case 'super-admin':
              console.log('Redirecting to Super Admin dashboard');
              navigate('/super-admin/dashboard', { replace: true });
              break;
            case 'hotel-owner':
              console.log('Redirecting to Hotel Owner dashboard');
              navigate('/hotel-owner/dashboard', { replace: true });
              break;
            case 'hotel-staff':
              console.log('Redirecting to Hotel Staff dashboard');
              navigate('/hotel-staff/profile', { replace: true });
              break;
            case 'guest':
              console.log('Redirecting to Guest dashboard');
              navigate('/guest/my-stays', { replace: true });
              break;
            default:
              console.log('Unknown role, redirecting to home');
              navigate('/', { replace: true });
          }
        };

        const timeoutId = setTimeout(redirectUser, 100);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [currentUser, userRole, loading, isRedirecting, navigate]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    console.log('Attempting login with:', { email, password: password ? '***' : 'empty' });

    try {
      await login(email, password);
    } catch (error) {
      console.error('Login error:', error);
      setError("Failed to sign in: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      await loginWithGoogle();
      // Don't set loading to false here - let the redirect handle it
    } catch (error) {
      setError("Failed to sign in with Google: " + error.message);
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Add country code for India
      const fullPhoneNumber = `+91${phoneNumber}`;

      // Create reCAPTCHA verifier
      const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: (response) => {
          // reCAPTCHA solved, allow signInWithPhoneNumber
          console.log('reCAPTCHA solved');
        },
        'expired-callback': () => {
          // Response expired. Ask user to solve reCAPTCHA again.
          console.log('reCAPTCHA expired');
        }
      });

      const result = await loginWithPhone(fullPhoneNumber, appVerifier);
      setConfirmationResult(result);
      setShowOtp(true);
    } catch (error) {
      setError("Failed to send OTP: " + error.message);
      console.error('Phone auth error:', error);
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
    } catch (error) {
      setError("Failed to verify OTP: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-16 mb-16 flex h-full w-full items-center justify-center px-2 md:mx-0 md:px-0 lg:mb-10 lg:items-center lg:justify-start">
      {/* Sign in section */}
      <div className="mt-[10vh] w-full max-w-full flex-col items-center md:pl-4 lg:pl-0 xl:max-w-[420px]">
        <h4 className="mb-2.5 text-4xl font-bold text-navy-700 dark:text-white">
          Hotel Management
        </h4>
        <p className="mb-9 ml-1 text-base text-gray-600">
          Sign in to access your dashboard
        </p>

        {/* Test Credentials - Remove in production */}
        <div className="mb-6 rounded-lg bg-blue-50 p-4 text-sm">
          <h6 className="mb-2 font-semibold text-blue-800">Test Credentials:</h6>
          <div className="space-y-1 text-blue-700">
            <div><strong>Super Admin:</strong> admin@test.com / password123</div>
            <div><strong>Hotel Owner:</strong> owner@test.com / password123</div>
            <div><strong>Hotel Staff:</strong> staff@test.com / password123</div>
            <div><strong>Guest:</strong> guest@test.com / password123</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 w-full rounded-lg bg-red-50 p-3 text-red-600">
            {error}
          </div>
        )}

        {/* Auth Method Toggle */}
        <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setAuthMethod("email")}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${authMethod === "email"
              ? "bg-white text-brand-500 shadow-sm"
              : "text-gray-600"
              }`}
          >
            Email
          </button>
          <button
            onClick={() => setAuthMethod("phone")}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${authMethod === "phone"
              ? "bg-white text-brand-500 shadow-sm"
              : "text-gray-600"
              }`}
          >
            Phone
          </button>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mb-6 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-lightPrimary hover:cursor-pointer dark:bg-navy-800 disabled:opacity-50"
        >
          <div className="rounded-full text-xl">
            <FcGoogle />
          </div>
          <h5 className="text-sm font-medium text-navy-700 dark:text-white">
            Sign In with Google
          </h5>
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="h-px w-full bg-gray-200 dark:bg-navy-700" />
          <p className="text-base text-gray-600 dark:text-white"> or </p>
          <div className="h-px w-full bg-gray-200 dark:bg-navy-700" />
        </div>

        {authMethod === "email" ? (
          <form onSubmit={handleEmailLogin}>
            {/* Email */}
            <InputField
              variant="auth"
              extra="mb-3"
              label="Email*"
              placeholder="mail@example.com"
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                console.log('Email changed:', e.target.value);
                setEmail(e.target.value);
              }}
              required
            />

            {/* Password */}
            <InputField
              variant="auth"
              extra="mb-3"
              label="Password*"
              placeholder="Min. 8 characters"
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                console.log('Password changed:', e.target.value ? '***' : 'empty');
                setPassword(e.target.value);
              }}
              required
            />

            {/* Checkbox */}
            <div className="mb-4 flex items-center justify-between px-2">
              <div className="flex items-center">
                <Checkbox />
                <p className="ml-2 text-sm font-medium text-navy-700 dark:text-white">
                  Keep me logged In
                </p>
              </div>
              <a
                className="text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-white"
                href="#"
              >
                Forgot Password?
              </a>
            </div>

            {/* Test Button */}
            <button
              type="button"
              onClick={() => {
                console.log('Current state:', { email, password: password ? '***' : 'empty' });
                setEmail('admin@test.com');
                setPassword('password123');
              }}
              className="mb-2 w-full rounded-xl bg-gray-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-gray-600"
            >
              Fill Test Data
            </button>

            <button
              type="submit"
              disabled={loading}
              className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 dark:bg-brand-400 dark:text-white dark:hover:bg-brand-300 dark:active:bg-brand-200 disabled:opacity-50"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        ) : (
          <div>
            {!showOtp ? (
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
                <button
                  type="submit"
                  disabled={loading}
                  className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 dark:bg-brand-400 dark:text-white dark:hover:bg-brand-300 dark:active:bg-brand-200 disabled:opacity-50"
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                </button>
              </form>
            ) : (
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
                  className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 dark:bg-brand-400 dark:text-white dark:hover:bg-brand-300 dark:active:bg-brand-200 disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOtp(false)}
                  className="mt-2 w-full text-sm text-brand-500 hover:text-brand-600"
                >
                  Back to Phone Number
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-4">
          <span className="text-sm font-medium text-navy-700 dark:text-gray-600">
            Not registered yet?
          </span>
          <a
            href="/auth/sign-up"
            className="ml-1 text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-white"
          >
            Create an account
          </a>
        </div>

        {/* reCAPTCHA container for phone auth */}
        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}
