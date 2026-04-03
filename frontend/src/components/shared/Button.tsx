"use client";

import { Children, cloneElement, isValidElement } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "gold" | "ink";
  size?: "xs" | "sm" | "md" | "lg";
  asChild?: boolean;
}

type SharedElement = HTMLElement;
type ButtonChildProps = React.HTMLAttributes<SharedElement> & {
  children?: React.ReactNode;
  className?: string;
};

function setPageAura(target: SharedElement, point?: { x: number; y: number }) {
  const shell = target.closest<HTMLElement>('[data-cta-reactive="true"]');
  if (!shell) return;

  const shellRect = shell.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const x = point?.x ?? targetRect.left + targetRect.width / 2;
  const y = point?.y ?? targetRect.top + targetRect.height / 2;

  shell.style.setProperty("--cta-aura-x", `${x - shellRect.left}px`);
  shell.style.setProperty("--cta-aura-y", `${y - shellRect.top}px`);
  shell.style.setProperty("--cta-aura-opacity", "1");
}

function clearPageAura(target: SharedElement) {
  const shell = target.closest<HTMLElement>('[data-cta-reactive="true"]');
  if (!shell) return;
  shell.style.setProperty("--cta-aura-opacity", "0");
}

function mergeClassNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function composeHandlers<Event>(
  ...handlers: Array<((event: Event) => void) | undefined>
) {
  return (event: Event) => {
    handlers.forEach((handler) => handler?.(event));
  };
}

const variants = {
  primary:
    "bg-navy text-white hover:bg-navy-light shadow-sm",
  secondary:
    "bg-surface-card text-ink-primary border border-border-medium hover:bg-surface-hover shadow-sm",
  ghost:
    "text-ink-secondary hover:bg-surface-hover",
  gold:
    "cta-wake cta-wake-gold font-semibold text-white",
  ink:
    "cta-wake cta-wake-ink text-white",
};

const sizes = {
  xs: "px-2.5 py-1 text-[0.82rem] rounded-lg",
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-xl",
  lg: "px-7 py-3.5 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  asChild = false,
  className = "",
  children,
  onMouseEnter,
  onMouseLeave,
  onPointerMove,
  onFocus,
  onBlur,
  ...props
}: ButtonProps) {
  const buttonClassName = mergeClassNames(
    "relative isolate inline-flex items-center justify-center font-medium transition hover:scale-[1.02] active:scale-[0.97] duration-[120ms] ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    className,
  );

  if (asChild) {
    const child = Children.only(children);

    if (!isValidElement<ButtonChildProps>(child)) {
      return null;
    }

    const childProps = child.props;
    const mergedChildProps: ButtonChildProps = {
      ...(props as Partial<ButtonChildProps>),
      ...childProps,
      className: mergeClassNames(buttonClassName, childProps.className),
      onMouseEnter: composeHandlers<React.MouseEvent<SharedElement>>(
        (event) => {
          setPageAura(event.currentTarget);
          onMouseEnter?.(event as React.MouseEvent<HTMLButtonElement>);
        },
        childProps.onMouseEnter,
      ),
      onMouseLeave: composeHandlers<React.MouseEvent<SharedElement>>(
        (event) => {
          clearPageAura(event.currentTarget);
          onMouseLeave?.(event as React.MouseEvent<HTMLButtonElement>);
        },
        childProps.onMouseLeave,
      ),
      onPointerMove: composeHandlers<React.PointerEvent<SharedElement>>(
        (event) => {
          setPageAura(event.currentTarget, { x: event.clientX, y: event.clientY });
          onPointerMove?.(event as React.PointerEvent<HTMLButtonElement>);
        },
        childProps.onPointerMove,
      ),
      onFocus: composeHandlers<React.FocusEvent<SharedElement>>(
        (event) => {
          setPageAura(event.currentTarget);
          onFocus?.(event as React.FocusEvent<HTMLButtonElement>);
        },
        childProps.onFocus,
      ),
      onBlur: composeHandlers<React.FocusEvent<SharedElement>>(
        (event) => {
          clearPageAura(event.currentTarget);
          onBlur?.(event as React.FocusEvent<HTMLButtonElement>);
        },
        childProps.onBlur,
      ),
    };

    return cloneElement(
      child,
      mergedChildProps,
      <span className="relative z-[1] inline-flex items-center justify-center gap-2">
        {childProps.children}
      </span>,
    );
  }

  return (
    <button
      onMouseEnter={(event) => {
        setPageAura(event.currentTarget);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        clearPageAura(event.currentTarget);
        onMouseLeave?.(event);
      }}
      onPointerMove={(event) => {
        setPageAura(event.currentTarget, { x: event.clientX, y: event.clientY });
        onPointerMove?.(event);
      }}
      onFocus={(event) => {
        setPageAura(event.currentTarget);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        clearPageAura(event.currentTarget);
        onBlur?.(event);
      }}
      className={buttonClassName}
      {...props}
    >
      <span className="relative z-[1] inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}
