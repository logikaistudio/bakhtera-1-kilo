import React, { useState } from 'react';
import Button from '../../components/Common/Button';
import { MapPin, Plus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

const MasterRoutes = () => {
    const { t } = useLanguage();
    const [routes, setRoutes] = useState([]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">{t("Master Routes")}</h1>
                    <p className="text-silver-dark mt-1">{t("Template rute pengiriman standar dengan default rates")}</p>
                </div>
                <Button icon={Plus}>{t("Route Baru")}</Button>
            </div>

            {routes.length === 0 ? (
                <div className="glass-card rounded-lg p-12 text-center">
                    <MapPin className="w-16 h-16 text-silver-dark mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-silver-light mb-2">{t("Belum Ada Master Route")}</h3>
                    <p className="text-silver-dark">
                        {t("Buat master route untuk mempercepat pembuatan quotation")}
                    </p>
                </div>
            ) : null}
        </div>
    );
};

export default MasterRoutes;
