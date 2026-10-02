import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Mail } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/utils/auth-errors";
import { Checkbox } from "@/components/ui/checkbox";
import { usePasswordVisibility } from "@/hooks/usePasswordVisibility";

import { AuthField } from "./AuthField";
import { PasswordInput } from "./PasswordInput";
import { Divider } from "./Divider";
import { SubmitButton } from "./SubmitButton";
import { SocialLogins } from "./SocialLogins";

const signinSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});
type SigninValues = z.infer<typeof signinSchema>;

export function SignInForm({ redirectUrl }: { redirectUrl?: string }) {
  const navigate = useNavigate();
  const { showPassword, togglePasswordVisibility } = usePasswordVisibility();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SigninValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const rememberMe = watch("rememberMe");

  const onSubmit = async (data: SigninValues) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
      toast.success("Welcome back!");
      navigate({ to: redirectUrl || "/dashboard", replace: true });
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <AuthField
        id="signin-email"
        label="Email Address"
        icon={Mail}
        placeholder="name@domain.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <PasswordInput
        id="signin-password"
        label="Password"
        placeholder="••••••••"
        showPassword={showPassword}
        onToggleVisibility={togglePasswordVisibility}
        error={errors.password?.message}
        {...register("password")}
      />

      <div className="flex items-center justify-between text-sm pt-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={(checked) => setValue("rememberMe", checked === true)}
            className="border-black/20 dark:border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <label
            htmlFor="remember-me"
            className="text-zinc-600 dark:text-white/70 text-sm cursor-pointer select-none"
          >
            Remember me
          </label>
        </div>
        <Link
          to="/forgot-password"
          className="text-zinc-600 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          Forgot password?
        </Link>
      </div>

      <SubmitButton isSubmitting={isSubmitting} text="Sign In" />

      <Divider />

      <SocialLogins mode="signin" redirectUrl={redirectUrl} />

    </form>
  );
}
