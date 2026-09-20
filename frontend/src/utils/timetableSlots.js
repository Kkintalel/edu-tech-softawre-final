export const formatTimetableTime = (value) => {
    if (!value) return '';
    const [hours, minutes] = value.split(':').map(Number);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

export const getTimetableTime = (entry) => {
    if (entry.startTime && entry.endTime) {
        return `${formatTimetableTime(entry.startTime)} - ${formatTimetableTime(entry.endTime)}`;
    }

    const legacySlots = {
        1: ['08:00', '09:00'],
        2: ['09:00', '10:00'],
        3: ['10:20', '11:20'],
        4: ['11:20', '12:20'],
        5: ['13:20', '14:20'],
        6: ['14:20', '15:20'],
    };
    const slot = legacySlots[entry.period];
    return slot ? `${formatTimetableTime(slot[0])} - ${formatTimetableTime(slot[1])}` : '';
};
