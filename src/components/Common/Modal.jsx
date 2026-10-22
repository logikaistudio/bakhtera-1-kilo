import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Button from './Button';
import { useLanguage } from '../../i18n/LanguageContext';

const Modal = ({ isOpen, onClose, title, children, size = 'medium', maxWidth }) => {
    // Map size to Tailwind classes
    const sizeClasses = {
        small: 'max-w-md',
        medium: 'max-w-2xl',
        large: 'max-w-5xl'
    };

    const modalWidth = maxWidth || sizeClasses[size] || sizeClasses.medium;
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className={`glass-card w-full ${modalWidth} max-h-[90vh] overflow-y-auto rounded-xl`}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-dark-border">
                                <h2 className="text-2xl font-bold text-silver-light">{title}</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-dark-surface smooth-transition text-silver-dark hover:text-silver"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                {children}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};

export default Modal;
