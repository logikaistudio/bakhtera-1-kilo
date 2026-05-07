import React, { useState } from 'react';
import Sidebar from './Sidebar';
import ErrorBoundary from '../ErrorBoundary';
import { Menu } from 'lucide-react';

const MainLayout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <div className="min-h-screen bg-dark-bg">
            <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            
            {/* Desktop Menu Button (Shows when sidebar is closed) */}
            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="hidden lg:flex fixed top-4 left-4 z-40 p-2 rounded-lg bg-dark-card border border-dark-border text-silver hover:text-silver-light smooth-transition"
                >
                    <Menu className="w-6 h-6" />
                </button>
            )}

            <main className={`min-h-screen bg-dark-bg transition-all duration-300 ${isSidebarOpen ? 'lg:pl-[308px]' : 'lg:pl-0'}`}>
                <div className={`p-4 lg:p-8 pt-16 ${!isSidebarOpen ? 'lg:pt-20' : 'lg:pt-8'} bg-dark-bg`}>
                    <ErrorBoundary>
                        {children}
                    </ErrorBoundary>
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
