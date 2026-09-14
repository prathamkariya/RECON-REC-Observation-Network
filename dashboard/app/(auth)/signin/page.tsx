"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleIcon } from "@/components/auth/google-icon";
import { useAuth } from "@/lib/auth-context";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type FormValues = z.infer<typeof schema>;

export default function SignInPage() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await signInWithEmail(values.email, values.password);
      router.push("/dashboard");
    } catch {
      setFormError("Couldn't sign in with those credentials.");
    }
  }

  async function onGoogle() {
    setFormError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch {
      setFormError("Couldn't sign in with Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="font-display text-[28px] leading-9 font-bold tracking-tight text-recon-ink">Welcome back</h1>
        <p className="text-sm text-recon-ink-dim">Sign in to issue and verify certificates.</p>
      </div>

      <Button
        variant="outline"
        className="w-full justify-center gap-2"
        onClick={onGoogle}
        disabled={googleLoading}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-recon-ink-dim">or</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-risk">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-recon-ink-dim hover:text-gold">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <p className="text-xs text-risk">{errors.password.message}</p>}
        </div>

        {formError && <p className="text-sm text-risk">{formError}</p>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-sm text-recon-ink-dim">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-gold hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
