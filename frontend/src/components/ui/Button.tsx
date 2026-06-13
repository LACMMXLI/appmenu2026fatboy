import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={isLoading || props.disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
          {
            'bg-primary text-white hover:bg-primary-hover shadow-[0_0_15px_rgba(229,9,20,0.3)]': variant === 'primary',
            'border border-outline bg-transparent hover:bg-surface-hover text-white': variant === 'outline',
            'hover:bg-surface text-white': variant === 'ghost',
            'bg-black/50 backdrop-blur-md text-white border border-white/10 hover:bg-black/70': variant === 'glass',
            'h-12 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3': size === 'sm',
            'h-14 rounded-xl px-8 text-lg font-bold uppercase tracking-wider': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        {...props}
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
