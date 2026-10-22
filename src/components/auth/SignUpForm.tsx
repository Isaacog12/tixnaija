import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Mail, User, AtSign } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/utils/auth-errors";
import { Checkbox } from "@/components/ui/checkbox";
import { usePasswordVisibility } from "@/hooks/usePasswordVisibility";

import { AuthField } from "./AuthField";
import { PasswordInput } from "./PasswordInput";
import { Divider } from "./Divider";
import { SubmitButton } from "./SubmitButton";
import { SocialLogins } from "./SocialLogins";

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Name must be at least 2 characters"),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string(),
    isOfAge: z.boolean().refine((val) => val === true, {
      message: "You must confirm you are 18 or older, or have guardian consent",
    }),
    termsAccepted: z.boolean().refine((val) => val === true, {
      message: "You must agree to the Terms, Privacy Policy, and Refund Policy",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type SignupValues = z.infer<typeof signupSchema>;

export function SignUpForm({ redirectUrl }: { redirectUrl?: string }) {
  const navigate = useNavigate();
  const { showPassword, togglePasswordVisibility: togglePassword } = usePasswordVisibility();
  const { showPassword: showConfirmPassword, togglePasswordVisibility: toggleConfirmPassword } =
    usePasswordVisibility();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      isOfAge: false,
      termsAccepted: false,
    },
  });

  const termsAccepted = watch("termsAccepted");
  const isOfAge = watch("isOfAge");

  const onSubmit = async (data: SignupValues) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: data.fullName, username: data.username },
        },
      });
      if (error) throw error;
      toast.success("Account created! You're signed in.");
      navigate({ to: redirectUrl || "/dashboard", replace: true });
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <AuthField
        id="signup-name"
        label="Full Name"
        icon={User}
        placeholder="Alex Johnson"
        error={errors.fullName?.message}
        {...register("fullName")}
      />

      <AuthField
        id="signup-username"
        label="Username"
        icon={AtSign}
        placeholder="alexj"
        error={errors.username?.message}
        {...register("username")}
      />

      <AuthField
        id="signup-email"
        label="Email Address"
        icon={Mail}
        placeholder="name@domain.com"
        error={errors.email?.message}
        {...register("email")}
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <PasswordInput
          id="signup-password"
          label="Password"
          placeholder="••••••••"
          showPassword={showPassword}
          onToggleVisibility={togglePassword}
          error={errors.password?.message}
          {...register("password")}
        />

        <PasswordInput
          id="signup-confirm"
          label="Confirm Password"
          placeholder="••••••••"
          showPassword={showConfirmPassword}
          onToggleVisibility={toggleConfirmPassword}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>

      <div className="space-y-3 pt-2 pb-2">
        <div className="flex items-start space-x-2">
          <Checkbox
            id="isOfAge"
            checked={isOfAge}
            onCheckedChange={(checked) =>
              setValue("isOfAge", checked === true, { shouldValidate: true })
            }
            className="mt-0.5 border-black/20 dark:border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <div className="grid leading-tight">
            <label
              htmlFor="isOfAge"
              className="text-xs text-zinc-600 dark:text-white/70 cursor-pointer select-none leading-relaxed"
            >
              I confirm that I am 18 years of age or older, or that I have the consent of a parent or legal guardian.
            </label>
            {errors.isOfAge && (
              <p className="text-xs text-destructive font-medium mt-1">{errors.isOfAge.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(checked) =>
              setValue("termsAccepted", checked === true, { shouldValidate: true })
            }
            className="mt-0.5 border-black/20 dark:border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <div className="grid leading-tight">
            <label
              htmlFor="terms"
              className="text-xs text-zinc-600 dark:text-white/70 cursor-pointer select-none leading-relaxed"
            >
              I agree to the{" "}
              <Link to="/terms" target="_blank" className="text-primary hover:underline">
                Terms of Service
              </Link>
              ,{" "}
              <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              , and{" "}
              <Link to="/refunds" target="_blank" className="text-primary hover:underline">
                Refund Policy
              </Link>
              .
            </label>
            {errors.termsAccepted && (
              <p className="text-xs text-destructive font-medium mt-1">{errors.termsAccepted.message}</p>
            )}
          </div>
        </div>
      </div>

      <SubmitButton
        isSubmitting={isSubmitting}
        disabled={!termsAccepted || !isOfAge}
        text="Create Account"
        className="!mt-2"
      />

      <Divider />

      <SocialLogins mode="signup" termsAccepted={termsAccepted && isOfAge} redirectUrl={redirectUrl} />

    </form>
  );
}
