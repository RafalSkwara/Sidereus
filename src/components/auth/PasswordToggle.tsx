import { Eye, EyeOff } from "lucide-react";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}

export function PasswordToggle({ visible, onToggle, showLabel, hideLabel }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-muted-foreground hover:text-heading focus-visible:outline-ring absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
      aria-label={visible ? hideLabel : showLabel}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}
