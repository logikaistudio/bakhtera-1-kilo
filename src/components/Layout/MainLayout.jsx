import React from 'react';
import Sidebar from './Sidebar';

const MainLayout = ({ children }) => {
    return (
        <div className="min-h-screen bg-dark-bg">
            <Sidebar />
            <main className="lg:pl-[308px] min-h-screen bg-dark-bg">
                <div className="p-4 lg:p-8 pt-16 lg:pt-8 bg-dark-bg">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
