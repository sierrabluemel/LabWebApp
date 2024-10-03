import addWorkDays from "./addWorkDays";

describe('addWorkdays', () => {
    test('skips weekends from Friday', () => {
        const startDate = new Date('Fri Sep 06 2024')
        const endDate = addWorkDays(startDate, 1);

        expect(endDate.toString()).toBe(new Date('Mon Sep 09 2024').toString())
    })

    test('skips weekends from Saturday', () => {
        const startDate = new Date('Sat Sep 07 2024')
        const endDate = addWorkDays(startDate, 1);

        expect(endDate.toString()).toBe(new Date('Mon Sep 09 2024').toString())
    })
})