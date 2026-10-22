import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

const StatCard = ({
    icon: Icon,
    label,
    title,
    value,
    trend,
    trendValue,
    iconColor = 'text-silver',
    borderColor = ''
}) => {
    const getTrendIcon = () => {
        if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
        if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
        return <Minus className="w-4 h-4 text-silver-dark" />;
    };

    const displayLabel = title || label;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-card glass-card-hover p-6 rounded-lg ${borderColor ? `border ${borderColor}` : ''}`}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg bg-dark-surface ${iconColor}`}>
                            <Icon className="w-6 h-6" />
                        </div>
                    </div>
                    <p className="text-silver-dark text-sm mb-2 font-medium">{displayLabel}</p>
                    <h3 className="text-3xl font-bold text-silver-light">{value}</h3>
                    {trendValue && (
                        <div className="flex items-center gap-1 mt-2">
                            {getTrendIcon()}
                            <span className="text-xs text-silver-dark">{trendValue}</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default StatCard;
