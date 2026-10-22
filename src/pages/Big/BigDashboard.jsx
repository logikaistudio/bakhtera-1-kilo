import React from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';
import StatCard from '../../components/Common/StatCard';
import Button from '../../components/Common/Button';
import {
    Calendar,
    Clock,
    CheckCircle,
    TrendingUp,
    Plus
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

const BigDashboard = () => {
    const { t } = useLanguage();
    const { events } = useData();
    const navigate = useNavigate();

    const totalEvents = events.length;
    const upcomingEvents = events.filter((e) => e.status === 'planning' || e.status === 'confirmed').length;
    const ongoingEvents = events.filter((e) => e.status === 'ongoing').length;
    const completedEvents = events.filter((e) => e.status === 'completed').length;

    const recentEvents = events.slice(-5).reverse();

    const statusColors = {
        'planning': 'bg-yellow-500/20 text-yellow-400',
        'confirmed': 'bg-blue-500/20 text-blue-400',
        'ongoing': 'bg-purple-500/20 text-purple-400',
        'completed': 'bg-green-500/20 text-green-400',
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-10 h-10 text-green-400" />
                        <h1 className="text-4xl font-bold gradient-text">BIG</h1>
                    </div>
                    <p className="text-silver-dark">{t("Event Organizer")}</p>
                </div>
                <Button onClick={() => navigate('/big/events')} icon={Plus}>
                    {t("New Event")}
                </Button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={Calendar}
                    label="Total Events"
                    value={totalEvents}
                    iconColor="text-green-400"
                />
                <StatCard
                    icon={Clock}
                    label="Upcoming"
                    value={upcomingEvents}
                    iconColor="text-blue-400"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Ongoing"
                    value={ongoingEvents}
                    iconColor="text-purple-400"
                />
                <StatCard
                    icon={CheckCircle}
                    label="Completed"
                    value={completedEvents}
                    iconColor="text-emerald-400"
                />
            </div>

            {/* Recent Events */}
            <div className="glass-card p-6 rounded-lg">
                <h2 className="text-2xl font-bold text-silver-light mb-4">{t("Recent Events")}</h2>
                {recentEvents.length === 0 ? (
                    <div className="text-center py-12">
                        <Calendar className="w-16 h-16 text-silver-dark mx-auto mb-4" />
                        <p className="text-silver-dark">{t("No events yet. Create your first event!")}</p>
                        <Button onClick={() => navigate('/big/events')} className="mt-4">
                            {t("Create Event")}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentEvents.map((event) => (
                            <div
                                key={event.id}
                                className="flex items-center justify-between p-4 bg-dark-surface rounded-lg hover:bg-dark-card smooth-transition"
                            >
                                <div className="flex-1">
                                    <h3 className="font-medium text-silver-light">{event.event_name}</h3>
                                    <p className="text-sm text-silver-dark">
                                        {event.event_date ? new Date(event.event_date).toLocaleDateString('id-ID') : '-'} • {event.venue || '-'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[event.status]}`}>
                                        {event.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Button
                    onClick={() => navigate('/big/events')}
                    variant="secondary"
                    className="w-full py-4"
                >
                    {t("Manage Events")}
                </Button>
                <Button
                    onClick={() => navigate('/big/quotations')}
                    variant="secondary"
                    className="w-full py-4"
                >
                    {t("Quotations")}
                </Button>
                <Button
                    onClick={() => navigate('/big/invoices')}
                    variant="secondary"
                    className="w-full py-4"
                >
                    {t("Invoices")}
                </Button>
                <Button
                    onClick={() => navigate('/customers')}
                    variant="secondary"
                    className="w-full py-4"
                >
                    {t("Customers")}
                </Button>
            </div>
        </div>
    );
};

export default BigDashboard;
