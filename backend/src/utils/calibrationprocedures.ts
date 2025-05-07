import { addMonths } from "date-fns";
import { parseDataBaseDate } from "./db";
import { AS_FOUND_FLAGS, EXPIRE_AFTER_13_MONTHS, EXPIRE_AFTER_25_MONTHS, EXPIRE_AFTER_7_MONTHS } from "../constants";

function filterReadings(readings: any[], setPoints: string[]) {
    return readings
        .filter((r) => setPoints.includes(r.set_point))
        .filter((r, i, arr) => arr.findIndex(r) == i)
}

function isPass(readings: any[], setPoints: string[]) {
    return readings.findIndex((r) => !r.pass && !AS_FOUND_FLAGS.includes(r.set_point)) != -1 && readings.length === setPoints.length;
}

const calibrationProcedures = {
    cp1: (readings: any[], equipment: any) => {
        let dueDate = addMonths(new Date(), EXPIRE_AFTER_25_MONTHS);
        let parsedDueDate = `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`;
        // @TODO load this from db
        let setPoints = ['-999.00', '28.00', '-25.00', '90.00'];
        readings = filterReadings(readings, setPoints)

        let certificateStatus = isPass(readings, setPoints) ? "PASS" : "FAIL";

        const calibrationDate = readings[0].timestamp;

        return {
            dueDate,
            calibrationDate,
            'CS2': parsedDueDate,
            'CS5': certificateStatus,
            'CD11': parseFloat(readings[1].set_point).toFixed(0) + '°C',
            'CD12': parseFloat(readings[1].reference_reading).toFixed(1) + '°C',
            'CD13': parseFloat(readings[0].sensor_reading).toFixed(1) + '°C',
            'CD14': (parseFloat(readings[1].sensor_reading) - parseFloat(readings[0].sensor_reading)).toFixed(1) + '°C',
            'CD15': parseFloat(readings[1].sensor_reading).toFixed(1) + '°C',
            'CD16': parseFloat(readings[1].tolerance).toFixed(1) + '°C',
            'CD17': parseFloat(readings[1].uncertainty).toFixed(3) + '°C',
            'CD18': (readings[1].pass ? 'PASS' : 'FAIL'),
            'CD21': parseFloat(readings[2].set_point).toFixed(0) + '°C',
            'CD22': parseFloat(readings[2].reference_reading).toFixed(1) + '°C',
            'CD23': parseFloat(readings[2].sensor_reading).toFixed(1) + '°C',
            'CD24': 'N/A',
            'CD25': parseFloat(readings[2].sensor_reading).toFixed(1) + '°C',
            'CD26': parseFloat(readings[2].tolerance).toFixed(1) + '°C',
            'CD27': parseFloat(readings[2].uncertainty).toFixed(3) + '°C',
            'CD28': (readings[2].pass ? 'PASS' : 'FAIL'),
            'CD31': parseFloat(readings[3].set_point).toFixed(0) + '°C',
            'CD32': parseFloat(readings[3].reference_reading).toFixed(1) + '°C',
            'CD33': parseFloat(readings[3].sensor_reading).toFixed(1) + '°C',
            'CD34': 'N/A',
            'CD35': parseFloat(readings[3].sensor_reading).toFixed(1) + '°C',
            'CD36': parseFloat(readings[3].tolerance).toFixed(1) + '°C',
            'CD37': parseFloat(readings[3].uncertainty).toFixed(3) + '°C',
            'CD38': (readings[3].pass ? 'PASS' : 'FAIL'),
            'RS11': equipment.reference1.asset_tag,
            'RS12': equipment.reference1.description,
            'RS13': parseDataBaseDate(equipment.reference1.last_calibration),
            'RS14': parseDataBaseDate(equipment.reference1.next_calibration),
            'RS21': equipment.reference2.asset_tag,
            'RS22': equipment.reference2.description,
            'RS23': parseDataBaseDate(equipment.reference2.last_calibration),
            'RS24': parseDataBaseDate(equipment.reference2.next_calibration),
            'RS31': equipment.reference3.asset_tag,
            'RS32': equipment.reference3.description,
            'RS33': parseDataBaseDate(equipment.reference3.last_calibration),
            'RS34': parseDataBaseDate(equipment.reference3.next_calibration),
            'RS41': equipment.superDaq.asset_tag,
            'RS42': equipment.superDaq.description,
            'RS43': parseDataBaseDate(equipment.superDaq.last_calibration),
            'RS44': parseDataBaseDate(equipment.superDaq.next_calibration),
            'TUR': '4:1',
        }
    },
    cp2: (readings: any[], equipment: any) => {
        let dueDate = addMonths(new Date(), EXPIRE_AFTER_13_MONTHS);
        let parsedDueDate = `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`;
        // @TODO load this from db
        let setPoints = ['-999.00', '0.00', '-80.00', '-197.00'];
        readings = filterReadings(readings, setPoints)

        let certificateStatus = isPass(readings, setPoints) ? "PASS" : "FAIL";

        const calibrationDate = readings[0].timestamp;

        return {
            dueDate,
            calibrationDate,
            'CS2': parsedDueDate,
            'CS5': certificateStatus,
            'CD11': parseFloat(readings[1].set_point).toFixed(0) + '°C',
            'CD12': parseFloat(readings[1].reference_reading).toFixed(1) + '°C',
            'CD13': parseFloat(readings[0].sensor_reading).toFixed(1) + '°C',
            'CD14': (parseFloat(readings[1].sensor_reading) - parseFloat(readings[0].sensor_reading)).toFixed(1) + '°C',
            'CD15': parseFloat(readings[1].sensor_reading).toFixed(1) + '°C',
            'CD16': parseFloat(readings[1].tolerance).toFixed(1) + '°C',
            'CD17': parseFloat(readings[1].uncertainty).toFixed(3) + '°C',
            'CD18': (readings[1].pass ? 'PASS' : 'FAIL'),
            'CD21': parseFloat(readings[2].set_point).toFixed(0) + '°C',
            'CD22': parseFloat(readings[2].reference_reading).toFixed(1) + '°C',
            'CD23': parseFloat(readings[2].sensor_reading).toFixed(1) + '°C',
            'CD24': 'N/A',
            'CD25': parseFloat(readings[2].sensor_reading).toFixed(1) + '°C',
            'CD26': parseFloat(readings[2].tolerance).toFixed(1) + '°C',
            'CD27': parseFloat(readings[2].uncertainty).toFixed(3) + '°C',
            'CD28': (readings[2].pass ? 'PASS' : 'FAIL'),
            'CD31': parseFloat(readings[3].set_point).toFixed(0) + '°C',
            'CD32': parseFloat(readings[3].reference_reading).toFixed(1) + '°C',
            'CD33': parseFloat(readings[3].sensor_reading).toFixed(1) + '°C',
            'CD34': 'N/A',
            'CD35': parseFloat(readings[3].sensor_reading).toFixed(1) + '°C',
            'CD36': parseFloat(readings[3].tolerance).toFixed(1) + '°C',
            'CD37': parseFloat(readings[3].uncertainty).toFixed(3) + '°C',
            'CD38': (readings[3].pass ? 'PASS' : 'FAIL'),
            'RS11': equipment.reference1.asset_tag,
            'RS12': equipment.reference1.description,
            'RS13': parseDataBaseDate(equipment.reference1.last_calibration),
            'RS14': parseDataBaseDate(equipment.reference1.next_calibration),
            'RS21': equipment.reference2.asset_tag,
            'RS22': equipment.reference2.description,
            'RS23': parseDataBaseDate(equipment.reference2.last_calibration),
            'RS24': parseDataBaseDate(equipment.reference2.next_calibration),
            'RS31': equipment.reference3.asset_tag,
            'RS32': equipment.reference3.description,
            'RS33': parseDataBaseDate(equipment.reference3.last_calibration),
            'RS34': parseDataBaseDate(equipment.reference3.next_calibration),
            'RS41': equipment.superDaq.asset_tag,
            'RS42': equipment.superDaq.description,
            'RS43': parseDataBaseDate(equipment.superDaq.last_calibration),
            'RS44': parseDataBaseDate(equipment.superDaq.next_calibration),
            'TUR': '4:1',
        }
    },
    cp3: (readings: any[], equipment: any) => {
        let dueDate = addMonths(new Date(), EXPIRE_AFTER_7_MONTHS);
        let parsedDueDate = `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`;

        // @TODO load this from db
        let temperatureSetPoints = ['20.00', '30.00', '40.00'];
        let temperatureReadings = filterReadings(readings.filter((r) => r.type === "temperature"), temperatureSetPoints);

        let humiditySetPoints = ['80.00', '50.00', '20.00'];
        let humidityReadings = filterReadings(readings.filter((r) => r.type === "humidity"), humiditySetPoints);

        let reference = equipment.rotronic;
        let certificateStatus = isPass(temperatureReadings, temperatureSetPoints) && isPass(humidityReadings, humiditySetPoints) ? "PASS" : "FAIL";

        const calibrationDate = readings[0].timestamp;

        return {
            dueDate,
            calibrationDate,
            'CS2': parsedDueDate,
            'CS5': certificateStatus,
            'CD11': parseFloat(humidityReadings[0].set_point).toFixed(0) + '% RH',
            'CD12': parseFloat(humidityReadings[0].reference_reading).toFixed(1) + '%',
            'CD13': parseFloat(humidityReadings[0].sensor_reading).toFixed(1) + '%',
            'CD14': 'N/A',
            'CD15': parseFloat(humidityReadings[0].sensor_reading).toFixed(1) + '%',
            'CD16': parseFloat(humidityReadings[0].tolerance).toFixed(1) + '%',
            'CD17': parseFloat(humidityReadings[0].uncertainty).toFixed(1) + '%',
            'CD18': (humidityReadings[0].pass ? 'PASS' : 'FAIL'),
            'CD21': parseFloat(humidityReadings[1].set_point).toFixed(0) + '% RH',
            'CD22': parseFloat(humidityReadings[1].reference_reading).toFixed(1) + '%',
            'CD23': parseFloat(humidityReadings[1].sensor_reading).toFixed(1) + '%',
            'CD24': 'N/A',
            'CD25': parseFloat(humidityReadings[1].sensor_reading).toFixed(1) + '%',
            'CD26': parseFloat(humidityReadings[1].tolerance).toFixed(1) + '%',
            'CD27': parseFloat(humidityReadings[1].uncertainty).toFixed(1) + '%',
            'CD28': (humidityReadings[1].pass ? 'PASS' : 'FAIL'),
            'CD31': parseFloat(humidityReadings[2].set_point).toFixed(0) + '% RH',
            'CD32': parseFloat(humidityReadings[2].reference_reading).toFixed(1) + '%',
            'CD33': parseFloat(humidityReadings[2].sensor_reading).toFixed(1) + '%',
            'CD34': 'N/A',
            'CD35': parseFloat(humidityReadings[2].sensor_reading).toFixed(1) + '%',
            'CD36': parseFloat(humidityReadings[2].tolerance).toFixed(1) + '%',
            'CD37': parseFloat(humidityReadings[2].uncertainty).toFixed(1) + '%',
            'CD38': (humidityReadings[2].pass ? 'PASS' : 'FAIL'),
            'CD41': parseFloat(temperatureReadings[0].set_point).toFixed(0) + '°C',
            'CD42': parseFloat(temperatureReadings[0].reference_reading).toFixed(1) + '°C',
            'CD43': parseFloat(temperatureReadings[0].sensor_reading).toFixed(1) + '°C',
            'CD44': 'N/A',
            'CD45': parseFloat(temperatureReadings[0].sensor_reading).toFixed(1) + '°C',
            'CD46': parseFloat(temperatureReadings[0].tolerance).toFixed(1) + '°C',
            'CD47': parseFloat(temperatureReadings[0].uncertainty).toFixed(2) + '°C',
            'CD48': (temperatureReadings[0].pass ? 'PASS' : 'FAIL'),
            'CD51': parseFloat(temperatureReadings[1].set_point).toFixed(0) + '°C',
            'CD52': parseFloat(temperatureReadings[1].reference_reading).toFixed(1) + '°C',
            'CD53': parseFloat(temperatureReadings[1].sensor_reading).toFixed(1) + '°C',
            'CD54': 'N/A',
            'CD55': parseFloat(temperatureReadings[1].sensor_reading).toFixed(1) + '°C',
            'CD56': parseFloat(temperatureReadings[1].tolerance).toFixed(1) + '°C',
            'CD57': parseFloat(temperatureReadings[1].uncertainty).toFixed(2) + '°C',
            'CD58': (temperatureReadings[1].pass ? 'PASS' : 'FAIL'),
            'CD61': parseFloat(temperatureReadings[2].set_point).toFixed(0) + '°C',
            'CD62': parseFloat(temperatureReadings[2].reference_reading).toFixed(1) + '°C',
            'CD63': parseFloat(temperatureReadings[2].sensor_reading).toFixed(1) + '°C',
            'CD64': 'N/A',
            'CD65': parseFloat(temperatureReadings[2].sensor_reading).toFixed(1) + '°C',
            'CD66': parseFloat(temperatureReadings[2].tolerance).toFixed(1) + '°C',
            'CD67': parseFloat(temperatureReadings[2].uncertainty).toFixed(2) + '°C',
            'CD68': (temperatureReadings[2].pass ? 'PASS' : 'FAIL'),
            'RS11': reference.asset_tag,
            'RS12': reference.description,
            'RS13': parseDataBaseDate(reference.last_calibration),
            'RS14': parseDataBaseDate(reference.next_calibration),
            'TUR': '1:1',
        }
    },
    cp4: (readings: any[], equipment: any) => {
        return calibrationProcedures.cp1(readings, equipment);
    },
    cp5: (readings: any[], equipment: any) => {
        let dueDate = addMonths(new Date(), EXPIRE_AFTER_25_MONTHS);
        let parsedDueDate = `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`;
        // @TODO load this from db
        let setPoints = ['-999.00', '20.00', '-20.00', '60.00'];
        readings = filterReadings(readings, setPoints)

        let certificateStatus = isPass(readings, setPoints) ? "PASS" : "FAIL";
        const calibrationDate = readings[0].timestamp;

        return {
            dueDate,
            calibrationDate,
            'CS2': parsedDueDate,
            'CS5': certificateStatus,
            'CD11': parseFloat(readings[1].set_point).toFixed(0) + '°C',
            'CD12': parseFloat(readings[1].reference_reading).toFixed(1) + '°C',
            'CD13': parseFloat(readings[0].sensor_reading).toFixed(1) + '°C',
            'CD14': (parseFloat(readings[1].sensor_reading) - parseFloat(readings[0].sensor_reading)).toFixed(1) + '°C',
            'CD15': parseFloat(readings[1].sensor_reading).toFixed(1) + '°C',
            'CD16': parseFloat(readings[1].tolerance).toFixed(1) + '°C',
            'CD17': parseFloat(readings[1].uncertainty).toFixed(3) + '°C',
            'CD18': (readings[1].pass ? 'PASS' : 'FAIL'),
            'CD21': parseFloat(readings[2].set_point).toFixed(0) + '°C',
            'CD22': parseFloat(readings[2].reference_reading).toFixed(1) + '°C',
            'CD23': parseFloat(readings[2].sensor_reading).toFixed(1) + '°C',
            'CD24': 'N/A',
            'CD25': parseFloat(readings[2].sensor_reading).toFixed(1) + '°C',
            'CD26': parseFloat(readings[2].tolerance).toFixed(1) + '°C',
            'CD27': parseFloat(readings[2].uncertainty).toFixed(3) + '°C',
            'CD28': (readings[2].pass ? 'PASS' : 'FAIL'),
            'CD31': parseFloat(readings[3].set_point).toFixed(0) + '°C',
            'CD32': parseFloat(readings[3].reference_reading).toFixed(1) + '°C',
            'CD33': parseFloat(readings[3].sensor_reading).toFixed(1) + '°C',
            'CD34': 'N/A',
            'CD35': parseFloat(readings[3].sensor_reading).toFixed(1) + '°C',
            'CD36': parseFloat(readings[3].tolerance).toFixed(1) + '°C',
            'CD37': parseFloat(readings[3].uncertainty).toFixed(3) + '°C',
            'CD38': (readings[3].pass ? 'PASS' : 'FAIL'),
            'RS11': equipment.rotronic.asset_tag,
            'RS12': equipment.rotronic.description,
            'RS13': parseDataBaseDate(equipment.rotronic.last_calibration),
            'RS14': parseDataBaseDate(equipment.rotronic.next_calibration),
            'RS21': equipment.chamber.asset_tag,
            'RS22': equipment.chamber.description,
            'RS23': parseDataBaseDate(equipment.chamber.last_calibration),
            'RS24': parseDataBaseDate(equipment.chamber.next_calibration),
            'TUR': '2:1',
        }
    },
    cp6: (readings: any[], equipment: any) => {
        let dueDate = addMonths(new Date(), EXPIRE_AFTER_25_MONTHS);
        let parsedDueDate = `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`;
        // @TODO load this from db
        let setPoints = ['-998.00', '-25.00', '-999.00', '28.00', '90.00'];
        readings = filterReadings(readings, setPoints)

        let certificateStatus = isPass(readings, setPoints) ? "PASS" : "FAIL";

        const calibrationDate = readings[0].timestamp;

        return {
            dueDate,
            calibrationDate,
            'CS2': parsedDueDate,
            'CS5': certificateStatus,
            'CD11': parseFloat(readings[1].set_point).toFixed(0) + '°C',
            'CD12': parseFloat(readings[1].reference_reading).toFixed(1) + '°C',
            'CD13': parseFloat(readings[0].sensor_reading).toFixed(1) + '°C',
            'CD14': (parseFloat(readings[1].sensor_reading) - parseFloat(readings[0].sensor_reading)).toFixed(1) + '°C',
            'CD15': parseFloat(readings[1].sensor_reading).toFixed(1) + '°C',
            'CD16': parseFloat(readings[1].tolerance).toFixed(1) + '°C',
            'CD17': parseFloat(readings[1].uncertainty).toFixed(3) + '°C',
            'CD18': (readings[1].pass ? 'PASS' : 'FAIL'),
            'CD21': parseFloat(readings[3].set_point).toFixed(0) + '°C',
            'CD22': parseFloat(readings[3].reference_reading).toFixed(1) + '°C',
            'CD23': parseFloat(readings[2].sensor_reading).toFixed(1) + '°C',
            'CD24': (parseFloat(readings[3].sensor_reading) - parseFloat(readings[2].sensor_reading)).toFixed(1) + '°C',
            'CD25': parseFloat(readings[3].sensor_reading).toFixed(1) + '°C',
            'CD26': parseFloat(readings[3].tolerance).toFixed(1) + '°C',
            'CD27': parseFloat(readings[3].uncertainty).toFixed(3) + '°C',
            'CD28': (readings[3].pass ? 'PASS' : 'FAIL'),
            'CD31': parseFloat(readings[4].set_point).toFixed(0) + '°C',
            'CD32': parseFloat(readings[4].reference_reading).toFixed(1) + '°C',
            'CD33': parseFloat(readings[4].sensor_reading).toFixed(1) + '°C',
            'CD34': 'N/A',
            'CD35': parseFloat(readings[4].sensor_reading).toFixed(1) + '°C',
            'CD36': parseFloat(readings[4].tolerance).toFixed(1) + '°C',
            'CD37': parseFloat(readings[4].uncertainty).toFixed(3) + '°C',
            'CD38': (readings[4].pass ? 'PASS' : 'FAIL'),
            'RS11': equipment.reference1.asset_tag,
            'RS12': equipment.reference1.description,
            'RS13': parseDataBaseDate(equipment.reference1.last_calibration),
            'RS14': parseDataBaseDate(equipment.reference1.next_calibration),
            'RS21': equipment.reference2.asset_tag,
            'RS22': equipment.reference2.description,
            'RS23': parseDataBaseDate(equipment.reference2.last_calibration),
            'RS24': parseDataBaseDate(equipment.reference2.next_calibration),
            'RS31': equipment.reference3.asset_tag,
            'RS32': equipment.reference3.description,
            'RS33': parseDataBaseDate(equipment.reference3.last_calibration),
            'RS34': parseDataBaseDate(equipment.reference3.next_calibration),
            'RS41': equipment.superDaq.asset_tag,
            'RS42': equipment.superDaq.description,
            'RS43': parseDataBaseDate(equipment.superDaq.last_calibration),
            'RS44': parseDataBaseDate(equipment.superDaq.next_calibration),
            'TUR': '4:1',
        }
    },
    cp7: (readings: any[], equipment: any) => {
        let dueDate = addMonths(new Date(), EXPIRE_AFTER_25_MONTHS);
        let parsedDueDate = `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`;
        // @TODO load this from db
        let setPoints = ['-999.00', '30.00', '40.00', '20.00', '10.00', '0.00', '-10.00', '-20.00', '-30.00'];
        readings = filterReadings(readings, setPoints)

        let certificateStatus = isPass(readings, setPoints) ? "PASS" : "FAIL";

        const calibrationDate = readings[0].timestamp;

        return {
            dueDate,
            calibrationDate,
            'CS2': parsedDueDate,
            'CS5': certificateStatus,
            'CD11': parseFloat(readings[1].set_point).toFixed(0) + '°C',
            'CD12': parseFloat(readings[1].reference_reading).toFixed(1) + '°C',
            'CD13': parseFloat(readings[0].sensor_reading).toFixed(1) + '°C',
            'CD14': (parseFloat(readings[1].sensor_reading) - parseFloat(readings[0].sensor_reading)).toFixed(1) + '°C',
            'CD15': parseFloat(readings[1].sensor_reading).toFixed(1) + '°C',
            'CD16': parseFloat(readings[1].tolerance).toFixed(1) + '°C',
            'CD17': parseFloat(readings[1].uncertainty).toFixed(3) + '°C',
            'CD18': (readings[1].pass ? 'PASS' : 'FAIL'),
            'CD21': parseFloat(readings[2].set_point).toFixed(0) + '°C',
            'CD22': parseFloat(readings[2].reference_reading).toFixed(1) + '°C',
            'CD23': parseFloat(readings[2].sensor_reading).toFixed(1) + '°C',
            'CD24': 'N/A',
            'CD25': parseFloat(readings[2].sensor_reading).toFixed(1) + '°C',
            'CD26': parseFloat(readings[2].tolerance).toFixed(1) + '°C',
            'CD27': parseFloat(readings[2].uncertainty).toFixed(3) + '°C',
            'CD28': (readings[2].pass ? 'PASS' : 'FAIL'),
            'CD31': parseFloat(readings[3].set_point).toFixed(0) + '°C',
            'CD32': parseFloat(readings[3].reference_reading).toFixed(1) + '°C',
            'CD33': parseFloat(readings[3].sensor_reading).toFixed(1) + '°C',
            'CD34': 'N/A',
            'CD35': parseFloat(readings[3].sensor_reading).toFixed(1) + '°C',
            'CD36': parseFloat(readings[3].tolerance).toFixed(1) + '°C',
            'CD37': parseFloat(readings[3].uncertainty).toFixed(3) + '°C',
            'CD38': (readings[3].pass ? 'PASS' : 'FAIL'),
            'CD41': parseFloat(readings[4].set_point).toFixed(0) + '°C',
            'CD42': parseFloat(readings[4].reference_reading).toFixed(1) + '°C',
            'CD43': parseFloat(readings[4].sensor_reading).toFixed(1) + '°C',
            'CD44': 'N/A',
            'CD45': parseFloat(readings[4].sensor_reading).toFixed(1) + '°C',
            'CD46': parseFloat(readings[4].tolerance).toFixed(1) + '°C',
            'CD47': parseFloat(readings[4].uncertainty).toFixed(3) + '°C',
            'CD48': (readings[3].pass ? 'PASS' : 'FAIL'),
            'CD51': parseFloat(readings[5].set_point).toFixed(0) + '°C',
            'CD52': parseFloat(readings[5].reference_reading).toFixed(1) + '°C',
            'CD53': parseFloat(readings[5].sensor_reading).toFixed(1) + '°C',
            'CD54': 'N/A',
            'CD55': parseFloat(readings[5].sensor_reading).toFixed(1) + '°C',
            'CD56': parseFloat(readings[5].tolerance).toFixed(1) + '°C',
            'CD57': parseFloat(readings[5].uncertainty).toFixed(3) + '°C',
            'CD58': (readings[3].pass ? 'PASS' : 'FAIL'),
            'CD61': parseFloat(readings[6].set_point).toFixed(0) + '°C',
            'CD62': parseFloat(readings[6].reference_reading).toFixed(1) + '°C',
            'CD63': parseFloat(readings[6].sensor_reading).toFixed(1) + '°C',
            'CD64': 'N/A',
            'CD65': parseFloat(readings[6].sensor_reading).toFixed(1) + '°C',
            'CD66': parseFloat(readings[6].tolerance).toFixed(1) + '°C',
            'CD67': parseFloat(readings[6].uncertainty).toFixed(3) + '°C',
            'CD68': (readings[3].pass ? 'PASS' : 'FAIL'),
            'CD71': parseFloat(readings[7].set_point).toFixed(0) + '°C',
            'CD72': parseFloat(readings[7].reference_reading).toFixed(1) + '°C',
            'CD73': parseFloat(readings[7].sensor_reading).toFixed(1) + '°C',
            'CD74': 'N/A',
            'CD75': parseFloat(readings[7].sensor_reading).toFixed(1) + '°C',
            'CD76': parseFloat(readings[7].tolerance).toFixed(1) + '°C',
            'CD77': parseFloat(readings[7].uncertainty).toFixed(3) + '°C',
            'CD78': (readings[3].pass ? 'PASS' : 'FAIL'),
            'CD81': parseFloat(readings[8].set_point).toFixed(0) + '°C',
            'CD82': parseFloat(readings[8].reference_reading).toFixed(1) + '°C',
            'CD83': parseFloat(readings[8].sensor_reading).toFixed(1) + '°C',
            'CD84': 'N/A',
            'CD85': parseFloat(readings[8].sensor_reading).toFixed(1) + '°C',
            'CD86': parseFloat(readings[8].tolerance).toFixed(1) + '°C',
            'CD87': parseFloat(readings[8].uncertainty).toFixed(3) + '°C',
            'CD88': (readings[3].pass ? 'PASS' : 'FAIL'),
            'RS11': equipment.reference2.asset_tag,
            'RS12': equipment.reference2.description,
            'RS13': parseDataBaseDate(equipment.reference2.last_calibration),
            'RS14': parseDataBaseDate(equipment.reference2.next_calibration),
            'RS21': equipment.superDaq.asset_tag,
            'RS22': equipment.superDaq.description,
            'RS23': parseDataBaseDate(equipment.superDaq.last_calibration),
            'RS24': parseDataBaseDate(equipment.superDaq.next_calibration),
            'TUR': '4:1',
        }
    },
    cp8: (readings: any[], equipment: any) => {
        let dueDate = addMonths(new Date(), EXPIRE_AFTER_7_MONTHS);
        let parsedDueDate = `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`;
        // @TODO load this from db
        let temperatureSetPoints = ['10.00', '20.00', '30.00', '40.00'];
        let humiditySetPoints = ['80.00', '60.00', '40.00', '20.00'];

        let finalTemperatureReadings = filterReadings(readings.filter((r) => r.type === "temperature"), temperatureSetPoints)
        let finalHumidityReadings = filterReadings(readings.filter((r) => r.type === "humidity"), humiditySetPoints)

        let certificateStatus = isPass(finalTemperatureReadings, temperatureSetPoints) && isPass(finalHumidityReadings, humiditySetPoints) ? "PASS" : "FAIL";

        let reference = equipment.rotronic;

        const calibrationDate = readings[0].timestamp;

        return {
            dueDate,
            calibrationDate,
            'CS2': parsedDueDate,
            'CS5': certificateStatus,
            'CD11': parseFloat(finalHumidityReadings[0].set_point).toFixed(0) + '% RH',
            'CD12': parseFloat(finalHumidityReadings[0].reference_reading).toFixed(1) + '%',
            'CD13': parseFloat(finalHumidityReadings[0].sensor_reading).toFixed(1) + '%',
            'CD14': 'N/A',
            'CD15': parseFloat(finalHumidityReadings[0].sensor_reading).toFixed(1) + '%',
            'CD16': parseFloat(finalHumidityReadings[0].tolerance).toFixed(1) + '%',
            'CD17': parseFloat(finalHumidityReadings[0].uncertainty).toFixed(1) + '%',
            'CD18': (finalHumidityReadings[0].pass ? 'PASS' : 'FAIL'),
            'CD21': parseFloat(finalHumidityReadings[1].set_point).toFixed(0) + '% RH',
            'CD22': parseFloat(finalHumidityReadings[1].reference_reading).toFixed(1) + '%',
            'CD23': parseFloat(finalHumidityReadings[1].sensor_reading).toFixed(1) + '%',
            'CD24': 'N/A',
            'CD25': parseFloat(finalHumidityReadings[1].sensor_reading).toFixed(1) + '%',
            'CD26': parseFloat(finalHumidityReadings[1].tolerance).toFixed(1) + '%',
            'CD27': parseFloat(finalHumidityReadings[1].uncertainty).toFixed(1) + '%',
            'CD28': (finalHumidityReadings[1].pass ? 'PASS' : 'FAIL'),
            'CD31': parseFloat(finalHumidityReadings[2].set_point).toFixed(0) + '% RH',
            'CD32': parseFloat(finalHumidityReadings[2].reference_reading).toFixed(1) + '%',
            'CD33': parseFloat(finalHumidityReadings[2].sensor_reading).toFixed(1) + '%',
            'CD34': 'N/A',
            'CD35': parseFloat(finalHumidityReadings[2].sensor_reading).toFixed(1) + '%',
            'CD36': parseFloat(finalHumidityReadings[2].tolerance).toFixed(1) + '%',
            'CD37': parseFloat(finalHumidityReadings[2].uncertainty).toFixed(1) + '%',
            'CD38': (finalHumidityReadings[2].pass ? 'PASS' : 'FAIL'),
            'CD41': parseFloat(finalHumidityReadings[3].set_point).toFixed(0) + '% RH',
            'CD42': parseFloat(finalHumidityReadings[3].reference_reading).toFixed(1) + '%',
            'CD43': parseFloat(finalHumidityReadings[3].sensor_reading).toFixed(1) + '%',
            'CD44': 'N/A',
            'CD45': parseFloat(finalHumidityReadings[3].sensor_reading).toFixed(1) + '%',
            'CD46': parseFloat(finalHumidityReadings[3].tolerance).toFixed(1) + '%',
            'CD47': parseFloat(finalHumidityReadings[3].uncertainty).toFixed(1) + '%',
            'CD48': (finalHumidityReadings[2].pass ? 'PASS' : 'FAIL'),
            'CD51': parseFloat(finalTemperatureReadings[0].set_point).toFixed(0) + '°C',
            'CD52': parseFloat(finalTemperatureReadings[0].reference_reading).toFixed(1) + '°C',
            'CD53': parseFloat(finalTemperatureReadings[0].sensor_reading).toFixed(1) + '°C',
            'CD54': 'N/A',
            'CD55': parseFloat(finalTemperatureReadings[0].sensor_reading).toFixed(1) + '°C',
            'CD56': parseFloat(finalTemperatureReadings[0].tolerance).toFixed(1) + '°C',
            'CD57': parseFloat(finalTemperatureReadings[0].uncertainty).toFixed(2) + '°C',
            'CD58': (finalTemperatureReadings[0].pass ? 'PASS' : 'FAIL'),
            'CD61': parseFloat(finalTemperatureReadings[1].set_point).toFixed(0) + '°C',
            'CD62': parseFloat(finalTemperatureReadings[1].reference_reading).toFixed(1) + '°C',
            'CD63': parseFloat(finalTemperatureReadings[1].sensor_reading).toFixed(1) + '°C',
            'CD64': 'N/A',
            'CD65': parseFloat(finalTemperatureReadings[1].sensor_reading).toFixed(1) + '°C',
            'CD66': parseFloat(finalTemperatureReadings[1].tolerance).toFixed(1) + '°C',
            'CD67': parseFloat(finalTemperatureReadings[1].uncertainty).toFixed(2) + '°C',
            'CD68': (finalTemperatureReadings[1].pass ? 'PASS' : 'FAIL'),
            'CD71': parseFloat(finalTemperatureReadings[2].set_point).toFixed(0) + '°C',
            'CD72': parseFloat(finalTemperatureReadings[2].reference_reading).toFixed(1) + '°C',
            'CD73': parseFloat(finalTemperatureReadings[2].sensor_reading).toFixed(1) + '°C',
            'CD74': 'N/A',
            'CD75': parseFloat(finalTemperatureReadings[2].sensor_reading).toFixed(1) + '°C',
            'CD76': parseFloat(finalTemperatureReadings[2].tolerance).toFixed(1) + '°C',
            'CD77': parseFloat(finalTemperatureReadings[2].uncertainty).toFixed(2) + '°C',
            'CD78': (finalTemperatureReadings[2].pass ? 'PASS' : 'FAIL'),
            'CD81': parseFloat(finalTemperatureReadings[3].set_point).toFixed(0) + '°C',
            'CD82': parseFloat(finalTemperatureReadings[3].reference_reading).toFixed(1) + '°C',
            'CD83': parseFloat(finalTemperatureReadings[3].sensor_reading).toFixed(1) + '°C',
            'CD84': 'N/A',
            'CD85': parseFloat(finalTemperatureReadings[3].sensor_reading).toFixed(1) + '°C',
            'CD86': parseFloat(finalTemperatureReadings[3].tolerance).toFixed(1) + '°C',
            'CD87': parseFloat(finalTemperatureReadings[3].uncertainty).toFixed(2) + '°C',
            'CD88': (finalTemperatureReadings[2].pass ? 'PASS' : 'FAIL'),
            'RS11': reference.asset_tag,
            'RS12': reference.description,
            'RS13': parseDataBaseDate(reference.last_calibration),
            'RS14': parseDataBaseDate(reference.next_calibration),
            'TUR': '1:1',
        }
    },
};

export default calibrationProcedures;
