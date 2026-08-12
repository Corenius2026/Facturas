import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'siigo';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
        {
          'border-transparent bg-primary text-primary-foreground': variant === 'default',
          'border-transparent bg-secondary text-secondary-foreground': variant === 'secondary',
          'border-transparent bg-destructive/15 text-destructive border-destructive/20': variant === 'destructive',
          'border-border text-foreground': variant === 'outline',
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300': variant === 'success',
          'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300': variant === 'warning',
          'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300': variant === 'info',
          'border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300': variant === 'siigo',
        },
        className
      )}
      {...props}
    />
  );
}
