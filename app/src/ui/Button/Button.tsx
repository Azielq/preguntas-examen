import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import s from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

function cls(variant: Variant, size: Size, extra?: string, wrap?: boolean) {
  return [s.btn, s[variant], size !== 'md' ? s[size] : '', wrap ? s.wrap : '', extra ?? ''].filter(Boolean).join(' ');
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  wrap?: boolean;
}

/** Deshabilitado con aria-disabled (sigue siendo enfocable y anuncia su estado). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, disabled, icon, iconRight, children, className, onClick, wrap, type = 'button', ...rest },
  ref,
) {
  const off = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      className={cls(variant, size, className, wrap)}
      aria-disabled={off || undefined}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (off) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  wrap?: boolean;
}

export function ButtonLink({ variant = 'secondary', size = 'md', icon, iconRight, children, className, wrap, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cls(variant, size, className, wrap)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  showLabel?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className, showLabel, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={showLabel ? undefined : label}
      title={label}
      className={[s.icon, showLabel ? s.iconLabel : '', className ?? ''].join(' ')}
      {...rest}
    >
      {children}
      {showLabel && <span>{label}</span>}
    </button>
  );
});

export interface ToggleIconButtonProps extends Omit<IconButtonProps, 'label'> {
  pressed: boolean;
  labelOn: string;
  labelOff: string;
}

export function ToggleIconButton({ pressed, labelOn, labelOff, ...rest }: ToggleIconButtonProps) {
  return <IconButton aria-pressed={pressed} label={pressed ? labelOn : labelOff} {...rest} />;
}
