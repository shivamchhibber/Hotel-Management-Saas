import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import InputField from "components/fields/InputField";
import TextField from "components/fields/TextField";
import { FcGoogle } from "react-icons/fc";
import Checkbox from "components/checkbox";
import { useAuth } from "contexts/AuthContext";

export default function SignUp() {
  const [formData, setFormData] = useState({
    // User Information
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    phoneNumber: "",
    
    // Hotel Information
    hotelName: "",
    hotelAddress: "",
    hotelCity: "",
    hotelState: "",
    hotelPincode: "",
    hotelPhone: "",
    hotelEmail: "",
    hotelDescription: "",
    totalRooms: "",
    amenities: []
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authMethod, setAuthMethod] = useState("email"); // email, google
  const [step, setStep] = useState(1); // 1: User Info, 2: Hotel Info

  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAmenityChange = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const validateStep1 = () => {
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

  const validateStep2 = () => {
    if (!formData.hotelName || !formData.hotelAddress || !formData.hotelCity || 
        !formData.hotelState || !formData.hotelPincode || !formData.hotelPhone || 
        !formData.hotelEmail || !formData.totalRooms) {
      setError("Please fill in all required hotel information");
      return false;
    }
    if (isNaN(formData.totalRooms) || parseInt(formData.totalRooms) < 1) {
      setError("Total rooms must be a valid number greater than 0");
      return false;
    }
    return true;
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError("");

    try {
      const userCredential = await loginWithGoogle();
      const user = userCredential.user;
      
      // Update user with display name if provided
      if (formData.displayName) {
        await setDoc(doc(db, 'users', user.uid), {
          displayName: formData.displayName,
          phoneNumber: formData.phoneNumber,
          role: 'hotel_owner',
          isActive: true,
          createdAt: serverTimestamp()
        }, { merge: true });
      }

      // Create hotel profile
      await createHotelProfile(user.uid);
      
      // Redirect to hotel owner dashboard
      navigate('/hotel-owner/dashboard');
    } catch (error) {
      setError("Failed to sign up with Google: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createHotelProfile = async (ownerId) => {
    const hotelData = {
      id: `hotel-${Date.now()}`,
      name: formData.hotelName,
      ownerId: ownerId,
      ownerName: formData.displayName,
      address: formData.hotelAddress,
      city: formData.hotelCity,
      state: formData.hotelState,
      pincode: formData.hotelPincode,
      phone: formData.hotelPhone,
      email: formData.hotelEmail,
      description: formData.hotelDescription,
      totalRooms: parseInt(formData.totalRooms),
      availableRooms: parseInt(formData.totalRooms),
      amenities: formData.amenities,
      isActive: true,
      totalRevenue: 0,
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, 'hotels', hotelData.id), hotelData);
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Create user account
      const userCredential = await signup(
        formData.email, 
        formData.password, 
        formData.displayName, 
        'hotel_owner'
      );

      const user = userCredential.user;

      // Update user with additional info
      await setDoc(doc(db, 'users', user.uid), {
        phoneNumber: formData.phoneNumber,
        role: 'hotel_owner',
        isActive: true,
        createdAt: serverTimestamp()
      }, { merge: true });

      // Create hotel profile
      await createHotelProfile(user.uid);
      
      // Redirect to hotel owner dashboard
      navigate('/hotel-owner/dashboard');
    } catch (error) {
      setError("Failed to create account: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
      setError("");
    }
  };

  const handleBack = () => {
    setStep(1);
    setError("");
  };

  const handleSubmit = (e) => {
    if (step === 2 && validateStep2()) {
      handleEmailSignUp(e);
    }
  };

  const commonAmenities = [
    "WiFi", "Parking", "Restaurant", "Room Service", "Laundry", 
    "Gym", "Pool", "Spa", "Business Center", "Conference Room",
    "Air Conditioning", "TV", "Mini Bar", "Safe", "Balcony"
  ];

  return (
    <div className="mt-16 mb-16 flex h-full w-full items-center justify-center px-2 md:mx-0 md:px-0 lg:mb-10 lg:items-center lg:justify-start">
      <div className="mt-[5vh] w-full max-w-full flex-col items-center md:pl-4 lg:pl-0 xl:max-w-[500px]">
        <h4 className="mb-2.5 text-4xl font-bold text-navy-700 dark:text-white">
          Create Hotel Account
        </h4>
        <p className="mb-9 ml-1 text-base text-gray-600">
          {step === 1 ? "Create your account" : "Set up your hotel profile"}
        </p>

        {/* Progress Indicator */}
        <div className="mb-6 flex items-center justify-center">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 1 ? 'bg-brand-500 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              1
            </div>
            <div className={`w-16 h-1 mx-2 ${step >= 2 ? 'bg-brand-500' : 'bg-gray-300'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 2 ? 'bg-brand-500 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              2
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 w-full rounded-lg bg-red-50 p-3 text-red-600">
            {error}
          </div>
        )}

        {step === 1 ? (
          <div>
            {/* Auth Method Toggle */}
            <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setAuthMethod("email")}
                className={`flex-1 rounded-md py-2 text-sm font-medium ${
                  authMethod === "email"
                    ? "bg-white text-brand-500 shadow-sm"
                    : "text-gray-600"
                }`}
              >
                Email
              </button>
              <button
                onClick={() => setAuthMethod("google")}
                className={`flex-1 rounded-md py-2 text-sm font-medium ${
                  authMethod === "google"
                    ? "bg-white text-brand-500 shadow-sm"
                    : "text-gray-600"
                }`}
              >
                Google
              </button>
            </div>

            {/* Google Sign Up */}
            {authMethod === "google" && (
              <div>
                <button
                  onClick={handleGoogleSignUp}
                  disabled={loading}
                  className="mb-6 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-lightPrimary hover:cursor-pointer dark:bg-navy-800 disabled:opacity-50"
                >
                  <div className="rounded-full text-xl">
                    <FcGoogle />
                  </div>
                  <h5 className="text-sm font-medium text-navy-700 dark:text-white">
                    Sign Up with Google
                  </h5>
                </button>

                <div className="mb-6 flex items-center gap-3">
                  <div className="h-px w-full bg-gray-200 dark:bg-navy-700" />
                  <p className="text-base text-gray-600 dark:text-white"> or </p>
                  <div className="h-px w-full bg-gray-200 dark:bg-navy-700" />
                </div>
              </div>
            )}

            {/* Email Sign Up Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
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
                label="Phone Number"
                placeholder="+91 9876543210"
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={handleInputChange}
              />

              {authMethod === "email" && (
                <>
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
                    placeholder="Confirm your password"
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                  />
                </>
              )}

              <button
                type="submit"
                className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 dark:bg-brand-400 dark:text-white dark:hover:bg-brand-300 dark:active:bg-brand-200"
              >
                Next: Hotel Information
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }}>
            <InputField
              variant="auth"
              extra="mb-3"
              label="Hotel Name*"
              placeholder="Grand Palace Hotel"
              id="hotelName"
              name="hotelName"
              type="text"
              value={formData.hotelName}
              onChange={handleInputChange}
              required
            />

            <TextField
              label="Hotel Address*"
              placeholder="123 Main Street, Area Name"
              id="hotelAddress"
              name="hotelAddress"
              rows={2}
              value={formData.hotelAddress}
              onChange={handleInputChange}
            />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <InputField
                variant="auth"
                label="City*"
                placeholder="Mumbai"
                id="hotelCity"
                name="hotelCity"
                type="text"
                value={formData.hotelCity}
                onChange={handleInputChange}
                required
              />
              <InputField
                variant="auth"
                label="State*"
                placeholder="Maharashtra"
                id="hotelState"
                name="hotelState"
                type="text"
                value={formData.hotelState}
                onChange={handleInputChange}
                required
              />
            </div>

            <InputField
              variant="auth"
              extra="mb-3"
              label="Pincode*"
              placeholder="400001"
              id="hotelPincode"
              name="hotelPincode"
              type="text"
              value={formData.hotelPincode}
              onChange={handleInputChange}
              required
            />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <InputField
                variant="auth"
                label="Hotel Phone*"
                placeholder="+91-22-12345678"
                id="hotelPhone"
                name="hotelPhone"
                type="tel"
                value={formData.hotelPhone}
                onChange={handleInputChange}
                required
              />
              <InputField
                variant="auth"
                label="Hotel Email*"
                placeholder="info@hotel.com"
                id="hotelEmail"
                name="hotelEmail"
                type="email"
                value={formData.hotelEmail}
                onChange={handleInputChange}
                required
              />
            </div>

            <InputField
              variant="auth"
              extra="mb-3"
              label="Total Rooms*"
              placeholder="50"
              id="totalRooms"
              name="totalRooms"
              type="number"
              value={formData.totalRooms}
              onChange={handleInputChange}
              required
            />

            <TextField
              label="Hotel Description"
              placeholder="Brief description of your hotel..."
              id="hotelDescription"
              name="hotelDescription"
              rows={3}
              value={formData.hotelDescription}
              onChange={handleInputChange}
            />

            {/* Amenities */}
            <div className="mb-4">
              <label className="ml-3 mb-2 text-sm font-bold text-navy-700 dark:text-white">
                Amenities
              </label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {commonAmenities.map((amenity) => (
                  <label key={amenity} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.amenities.includes(amenity)}
                      onChange={() => handleAmenityChange(amenity)}
                      className="mr-2"
                    />
                    <span className="text-sm text-navy-700 dark:text-white">{amenity}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 rounded-xl bg-gray-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-gray-600"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 linear rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 dark:bg-brand-400 dark:text-white dark:hover:bg-brand-300 dark:active:bg-brand-200 disabled:opacity-50"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-4">
          <span className="text-sm font-medium text-navy-700 dark:text-gray-600">
            Already have an account?
          </span>
          <a
            href="/auth/sign-in"
            className="ml-1 text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-white"
          >
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
