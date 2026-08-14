"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import PasswordInput from "@/components/PasswordInput";
import Toast from "@/components/Toast";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  function validateClientSide(): boolean {
    const errors: FieldErrors = {};

    if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    if (!validateClientSide()) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setFieldErrors({
            email: data.error || "An account with this email already exists",
          });
        } else if (res.status === 400 && data.details?.fieldErrors) {
          const fe = data.details.fieldErrors as Record<string, string[]>;
          setFieldErrors({
            name: fe.name?.[0],
            email: fe.email?.[0],
            password: fe.password?.[0],
          });
        } else {
          setFormError(data.error || "Registration failed");
        }
        setIsLoading(false);
        return;
      }

      // Success toast handles its own timing and redirects via onClose below
      setShowSuccess(true);
    } catch {
      setFormError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <>
      {showSuccess && (
        <Toast
          message="Account created successfully! Redirecting to login…"
          variant="success"
          onClose={() => router.push("/login")}
        />
      )}
      <AuthCard
        title="Create your account"
        subtitle="Start studying smarter with your own AI assistant."
        footer={
          <p className="text-sm text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium">
              Log in
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm mb-1 text-gray-300">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
            />
            {fieldErrors.name && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm mb-1 text-gray-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
            />
            {fieldErrors.email && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <PasswordInput
              id="password"
              name="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            {fieldErrors.password && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              label="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter your password"
            />
            {fieldErrors.confirmPassword && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          {formError && <p className="text-red-400 text-sm">{formError}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-medium py-2.5 hover:from-violet-400 hover:to-indigo-500 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </AuthCard>
    </>
  );
}