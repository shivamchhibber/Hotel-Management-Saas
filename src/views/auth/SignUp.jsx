import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import InputField from "components/fields/InputField";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "contexts/AuthContext";

export default function SignUp() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    phoneNumber: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authMethod, setAuthMethod] = useState("email");

  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.displayName) {
      setError("Please fill in all required fields");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return false;
    }
    return true;
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      navigate("/guest/my-stays", { replace: true });
    } catch (err) {
      setError("Failed to sign up with Google: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const cred = await signup(formData.email, formData.password, formData.displayName);
      const uid = cred.user.uid;
      if (formData.phoneNumber.trim()) {
        await setDoc(
          doc(db, "users", uid),
          { phoneNumber: formData.phoneNumber.trim() },
          { merge: true }
        );
      }
      navigate("/guest/my-stays", { replace: true });
    } catch (err) {
      setError("Failed to create account: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-16 mb-16 flex h-full w-full items-center justify-center px-2 md:mx-0 md:px-0 lg:mb-10 lg:items-center lg:justify-start">
      <div className="mt-[5vh] w-full max-w-full flex-col items-center md:pl-4 lg:pl-0 xl:max-w-[500px]">
        <h4 className="mb-2.5 text-4xl font-bold text-navy-700 dark:text-white">
          Create guest account
        </h4>
        <p className="mb-4 ml-1 text-base text-gray-600 dark:text-white">
          New accounts are created as <strong>guests</strong>. To list and manage a property, a super admin must
          attach a hotel to your account after you sign up with the same email in Firebase Authentication.
        </p>

        {error && (
          <div className="mb-4 w-full rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mb-6 flex rounded-lg bg-gray-100 p-1 dark:bg-navy-800">
          <button
            type="button"
            onClick={() => setAuthMethod("email")}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              authMethod === "email" ? "bg-white text-brand-500 shadow-sm dark:bg-navy-700 dark:text-white" : "text-gray-600"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod("google")}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              authMethod === "google" ? "bg-white text-brand-500 shadow-sm dark:bg-navy-700 dark:text-white" : "text-gray-600"
            }`}
          >
            Google
          </button>
        </div>

        {authMethod === "google" ? (
          <div>
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading}
              className="mb-6 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-lightPrimary hover:cursor-pointer dark:bg-navy-800 disabled:opacity-50"
            >
              <FcGoogle className="text-xl" />
              <span className="text-sm font-medium text-navy-700 dark:text-white">Sign up with Google</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailSignUp}>
            <InputField
              variant="auth"
              extra="mb-3"
              label="Full Name*"
              placeholder="John Doe"
              id="displayName"
              name="displayName"
              type="text"
              value={formData.displayName}
              onChange={handleInputChange}
              required
            />
            <InputField
              variant="auth"
              extra="mb-3"
              label="Email*"
              placeholder="mail@example.com"
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            <InputField
              variant="auth"
              extra="mb-3"
              label="Phone (optional)"
              placeholder="+91 9876543210"
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={handleInputChange}
            />
            <InputField
              variant="auth"
              extra="mb-3"
              label="Password*"
              placeholder="Min. 6 characters"
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
            <InputField
              variant="auth"
              extra="mb-3"
              label="Confirm Password*"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        <div className="mt-4 text-sm text-navy-700 dark:text-gray-400">
          Already have an account?{" "}
          <Link to="/auth/sign-in" className="font-medium text-brand-500 hover:text-brand-600">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
