/**
 * Enum representing different date filter types
 */
export enum DateFilterType {
    ALL_TIME = 'allTime',
    TODAY = 'today',
    THIS_WEEK = 'thisWeek',
    THIS_MONTH = 'thisMonth',
    LAST_6_MONTHS = 'last6Months',
    CUSTOM = 'custom'
}

/**
 * Interface representing a date range
 */
export interface DateRange {
    startDate?: Date;
    endDate?: Date;
}

/**
 * Gets the date range based on the filter type
 */
export function getDateRange(
    filterType: DateFilterType,
    customStart?: string,
    customEnd?: string
): DateRange {
    const now = new Date();

    switch (filterType) {
        case DateFilterType.ALL_TIME:
            return {};

        case DateFilterType.TODAY:
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return { startDate: today, endDate: now };

        case DateFilterType.THIS_WEEK:
            const thisWeekStart = new Date();
            thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
            thisWeekStart.setHours(0, 0, 0, 0);
            return { startDate: thisWeekStart, endDate: now };

        case DateFilterType.THIS_MONTH:
            const thisMonthStart = new Date();
            thisMonthStart.setDate(1);
            thisMonthStart.setHours(0, 0, 0, 0);
            return { startDate: thisMonthStart, endDate: now };

        case DateFilterType.LAST_6_MONTHS:
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            return { startDate: sixMonthsAgo, endDate: now };

        case DateFilterType.CUSTOM:
            if (customStart && customEnd) {
                return {
                    startDate: new Date(customStart),
                    endDate: new Date(customEnd)
                };
            }
            return {};

        default:
            return {};
    }
}

/**
 * Validates if a string is in YYYY-MM-DD format
 */
export function validateDateFormat(value: string): string | undefined {
    if (!value) { return undefined; }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
        return 'Please enter date in YYYY-MM-DD format';
    }
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
        return 'Invalid date';
    }
    
    return undefined;
}

/**
 * Formats a date as a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 60) {
        return `${diffMinutes} minute(s) ago`;
    } else if (diffMinutes < 1440) {
        const hours = Math.floor(diffMinutes / 60);
        return `${hours} hour(s) ago`;
    } else {
        return date.toLocaleDateString();
    }
}
