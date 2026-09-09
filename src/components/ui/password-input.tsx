"use client";

import { useId, useState, type ComponentProps } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordInput({
  id,
  disabled,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";

  return (
    <div className="flex items-center gap-2">
      <Input
        {...props}
        disabled={disabled}
        id={inputId}
        type={visible ? "text" : "password"}
      />
      <Button
        aria-controls={inputId}
        aria-label={label}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
        size="icon-lg"
        title={label}
        type="button"
        variant="ghost"
      >
        {visible ? (
          <IconEyeOff aria-hidden="true" stroke={1.75} />
        ) : (
          <IconEye aria-hidden="true" stroke={1.75} />
        )}
      </Button>
    </div>
  );
}
