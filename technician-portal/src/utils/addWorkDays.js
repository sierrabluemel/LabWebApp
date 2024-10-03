export default function addWorkDays(date, workDays) {
	for (let i = 0; i < workDays; i++) {
		date.setDate(date.getDate() + 1);
		if (date.getDay() === 6) {
			date.setDate(date.getDate() + 2); // Skip weekend
		} else if (date.getDay() === 0) {
			date.setDate(date.getDate() + 1);
		}
	}

	return date;
}