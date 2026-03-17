"use client";

import { useState, useTransition } from "react";
import { loginAction } from "./actions";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    startTransition(async () => {
      const res = await loginAction(password);
      if (res.ok) {
        router.refresh();
      } else {
        setError(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow-lg">
      <h1 className="text-xl font-bold">Admin Nemovia</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        autoFocus
      />
      {error && <p className="text-sm text-red-500">Password errata</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "..." : "Accedi"}
      </button>
    </form>
  );
}
