import moment from 'moment';

export type WeeklyInput = {
	deliveryDate?: string;
	deliveryDayOfWeek?: string;
	minDaysInAdvance?: number;
};

const weekDays: Map<string, number> = new Map([
	['SUNDAY', 0],
	['MONDAY', 1],
	['TUESDAY', 2],
	['WEDNESDAY', 3],
	['THURSDAY', 4],
	['FRIDAY', 5],
	['SATURDAY', 6],
	['SUN', 0],
	['MON', 1],
	['TUE', 2],
	['WED', 3],
	['THU', 4],
	['FRI', 5],
	['SAT', 6],
]);

export function getDeliveryDate(input: WeeklyInput) {
	if (input.deliveryDate) {
		const deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD');
		if (!deliveryDate.isValid()) {
			throw new Error('deliveryDate must be in the format "YYYY-MM-DD"');
		}
		return deliveryDate;
	}
	if (input.deliveryDayOfWeek && typeof input.minDaysInAdvance === 'number') {
		const dayOfWeek = input.deliveryDayOfWeek;
		const minDaysInAdvance = input.minDaysInAdvance;
		const dayOfWeekNum = weekDays.get(dayOfWeek.toUpperCase().trim());
		if (dayOfWeekNum === undefined || dayOfWeekNum == null) {
			throw new Error(`${dayOfWeek} is not a valid day of the week`);
		}
		const minDate = moment().startOf('day').add(minDaysInAdvance, 'days');
		const dayInWeek = minDate.clone().weekday(dayOfWeekNum);

		if (dayInWeek.isBefore(minDate)) {
			return dayInWeek.add(7, 'days');
		} else {
			return dayInWeek;
		}
	}
	throw new Error(
		'deliveryDate or (deliveryDayOfWeek and minDaysInAdvance) input params must be provided',
	);
}
