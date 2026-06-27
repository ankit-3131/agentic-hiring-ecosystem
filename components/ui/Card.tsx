import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={`bg-card border border-border rounded-lg shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className, ...props }) => (
    <div className={`p-6 border-b border-border ${className}`} {...props}>{children}</div>
);

export const CardContent: React.FC<CardProps> = ({ children, className, ...props }) => (
    <div className={`p-6 ${className}`} {...props}>{children}</div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className, ...props }) => (
    <h3 className={`text-lg font-semibold leading-none tracking-tight text-foreground ${className}`} {...props}>{children}</h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className, ...props }) => (
    <p className={`text-sm text-muted-foreground ${className}`} {...props}>{children}</p>
);


export default Card;
