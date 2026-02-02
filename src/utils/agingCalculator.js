export const calculateDaysDifference = (dateString) => {
    if (!dateString) return 0;
    const start = new Date(dateString);
    const end = new Date();
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getAgingStatus = (days) => {
    if (days > 90) return { color: 'text-red-500 font-bold', label: '> 90 Hari', isAlert: true };
    if (days > 60) return { color: 'text-yellow-500 font-semibold', label: '> 60 Hari', isAlert: false };
    return { color: 'text-green-500', label: 'Normal', isAlert: false };
};
