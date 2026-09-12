"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

const schema = z.object({ email: z.string().email("Enter a valid email address") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { sendResetEmail } = useAuth();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await sendResetEmail(values.email);
      setSent(true);
    } catch {
      setFormError("Couldn't send a reset email to that address.");
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Check your inbox</h1>
        <p className="text-sm text-recon-ink-dim">
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </p>
        <Link href="/signin" className="text-sm text-gold hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-recon-ink-dim">We&apos;ll email you a link to set a new one.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-risk">{errors.email.message}</p>}
        </div>

        {formError && <p className="text-sm text-risk">{formError}</p>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-sm text-recon-ink-dim">
        <Link href="/signin" className="text-gold hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
