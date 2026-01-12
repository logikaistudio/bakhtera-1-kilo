import React from 'react';
import { motion } from 'framer-motion';

const Button = ({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    className = '',
    disabled = false,
    type = 'button'
}) => {
    const baseClasses = 'rounded-lg font-medium smooth-transition flex items-center justify-center gap-2';

    const variants = {
        primary: 'bg-accent-blue text-white hover:bg-accent-cyan btn-glow',
        secondary: 'bg-dark-card text-silver border border-dark-border hover:border-accent-blue',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        ghost: 'bg-transparent text-silver hover:bg-dark-surface',
        success: 'bg-green-600 text-white hover:bg-green-700',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    };

    const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

    return (
        <motion.button
            whileHover={!disabled ? { scale: 1.02 } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
            onClick={onClick}
            disabled={disabled}
            type={type}
            className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${disabledClasses} ${className}`}
        >
            {Icon && <Icon className="w-5 h-5" />}
            {children}
        </motion.button>
    );
};

export default Button;
