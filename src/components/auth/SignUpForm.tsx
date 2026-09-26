import React, { useState } from "react";
import { Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { ServerError } from "@/components/forms/ServerError";
import { getMessages, plural, translateKey } from "@/i18n";
import type { Locale } from "@/lib/preferences";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  /** A message key from `?error=`; translated here, unknown values read as the generic auth message. */
  serverError?: string | null;
  locale: Locale;
}

export default function SignUpForm({ serverError, locale }: Props) {
  const m = getMessages(locale);
  const t = m.auth.signUp;
  const v = m.auth.validation;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  function validate() {
    const next: typeof errors = {};

    if (!email.trim()) {
      next.email = v.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = v.emailInvalid;
    }

    if (!password) {
      next.password = v.passwordRequired;
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = v.passwordTooShort({ min: String(MIN_PASSWORD_LENGTH) });
    }

    if (!confirmPassword) {
      next.confirmPassword = v.confirmRequired;
    } else if (password !== confirmPassword) {
      next.confirmPassword = v.passwordsDiffer;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  const missing = MIN_PASSWORD_LENGTH - password.length;
  const passwordHint =
    !errors.password && password.length > 0 && missing > 0 ? (
      <p className="text-muted-foreground mt-1 text-xs">
        {plural(locale, missing, t.moreCharacters)({ count: String(missing) })}
      </p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label={m.auth.email}
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder={m.auth.emailPlaceholder}
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id="password"
        label={m.auth.password}
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder={t.passwordPlaceholder}
        error={errors.password}
        hint={passwordHint}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
            showLabel={m.auth.showPassword}
            hideLabel={m.auth.hidePassword}
          />
        }
      />

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label={t.confirmPassword}
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder={t.confirmPlaceholder}
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
            showLabel={m.auth.showPassword}
            hideLabel={m.auth.hidePassword}
          />
        }
      />

      <ServerError message={serverError ? translateKey(m, serverError, "errors.auth.generic") : null} />

      <SubmitButton pendingText={t.pending} icon={<UserPlus className="size-4" />}>
        {t.submit}
      </SubmitButton>
    </form>
  );
}
