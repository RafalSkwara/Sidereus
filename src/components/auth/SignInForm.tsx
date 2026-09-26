import React, { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { ServerError } from "@/components/forms/ServerError";
import { getMessages, translateKey } from "@/i18n";
import type { Locale } from "@/lib/preferences";

interface Props {
  /** A message key from `?error=`; translated here, unknown values read as the generic auth message. */
  serverError?: string | null;
  locale: Locale;
}

export default function SignInForm({ serverError, locale }: Props) {
  const m = getMessages(locale);
  const v = m.auth.validation;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = v.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = v.emailInvalid;
    }
    if (!password) {
      next.password = v.passwordRequired;
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

  return (
    <form method="POST" action="/api/auth/signin" className="space-y-4" onSubmit={handleSubmit} noValidate>
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
        placeholder={m.auth.signIn.passwordPlaceholder}
        error={errors.password}
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

      <ServerError message={serverError ? translateKey(m, serverError, "errors.auth.generic") : null} />

      <SubmitButton pendingText={m.auth.signIn.pending} icon={<LogIn className="size-4" />}>
        {m.auth.signIn.submit}
      </SubmitButton>
    </form>
  );
}
