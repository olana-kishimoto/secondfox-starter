"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  pendingLabel?: string;
  variant?: "primary" | "ghost" | "danger";
  size?: "md" | "sm";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      {...rest}
      type="submit"
      variant={variant}
      size={size}
      className={className}
      loading={pending}
    >
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
