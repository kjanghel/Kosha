import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className = '', children, ...rest }: Props) {
  return (
    <div
      className={`rounded-2xl bg-white shadow-sm border border-slate-100 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardBody({ className = '', children, ...rest }: Props) {
  return (
    <div className={`p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}
