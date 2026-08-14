"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import AuthCard from "@/components/AuthCard";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const emailValue = formData.get("email") as string;
    const passwordValue = formData.get("password") as string;

    const result = await signIn("credentials", {
      email: emailValue,
      password: passwordValue,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setIsLoading(false);
      return;
    }

    router.push("/chat");
    router.refresh();
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <p className="text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-violet-400 hover:text-violet-300 font-medium">
            Register
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm mb-1 text-gray-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
          />
        </div>

        <PasswordInput
          id="password"
          name="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="Your password"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-medium py-2.5 hover:from-violet-400 hover:to-indigo-500 transition-colors disabled:opacity-50"
        >
          {isLoading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </AuthCard>
  );
}