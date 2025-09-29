/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-loop-func */
import React, { useState, useEffect, useRef } from 'react';
import { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';
import styles from "../../styles/styles.module.css";
import callApi from '../../utils/api/callApi';
import addWorkDays from '../../utils/addWorkDays';

Chart.register(
	CategoryScale, LinearScale, BarElement,
	Title, Tooltip, Legend, ChartDataLabels
);

function Metrics() {
	const today = new Date();
	const [totalSensors, setTotalSensors] = useState([]);
	const calibrationProcedures = useRef([]);
	const [datasets, setDataSets] = useState([]);
	const [totalDataSets, setTotalDataSets] = useState([]);
	const [activeSensors, setActiveSensors] = useState(0);
	const [nextOrderDue, setNextOrderDue] = useState(<></>);
	const [bestMonth, setBestMonth] = useState('');
	const [bestMonthTotal, setBestMonthTotal] = useState(0);
	const [sensorsInReceiving, setSensorsInReceiving] = useState(0);
	const [sensorsInShipping, setSensorsInShipping] = useState(0);
	const isMounted = useRef(false);

	const monthNames = [
		"January", "February", "March", "April", "May", "June", "July",
		"August", "September", "October", "November", "December"
	];

	useEffect(() => {
		if (isMounted.current)
			return

		isMounted.current = true;
		const today = new Date()

		const fetchData = async () => {
			callApi('get-active-sensors')
				.then(response => {
					setActiveSensors(response.length);
					let dueDate;
					let orderDue;
					let sensorsToTest = 0;
					let sensorsToShip = 0;
					for (const sensor of response) {
						if (sensor.current_location) {
							if (sensor.current_location.startsWith('R')) {
								sensorsToTest += 1;
							} else if (sensor.current_location.startsWith('S')) {
								sensorsToShip += 1;
							}
						}
						let sensorDue;
						sensor.expedited ? sensorDue = addWorkDays(new Date(sensor.received_timestamp), 2) :
						sensorDue = addWorkDays(new Date(sensor.received_timestamp), 7);

						if (!dueDate || sensorDue < dueDate) {
							dueDate = sensorDue;
							orderDue = sensor.customer_order_number;
						}
					}
					let spanClass;
					if (addWorkDays(today, 0) > dueDate) {
						spanClass = styles.red;
					} else if (addWorkDays(new Date(), 3) < dueDate) {
						spanClass = styles.green;
					} else {
						spanClass = styles.yellow;
					}
					setNextOrderDue(
						<>
							<span className={`${spanClass}`}>
								{dueDate.getMonth() + 1}/{dueDate.getDate()}/{dueDate.getFullYear()}
							</span>
							({orderDue})
						</>
					);
					setSensorsInReceiving(sensorsToTest);
					setSensorsInShipping(sensorsToShip);
				})

			const colors = ['#FF000095', '#0000FF95', '#FFFF0095', '#FF000095', '#FFFF0095', '#08afe695']
			const promises = [];
			calibrationProcedures.current = await callApi('get-calibration-procedures')
			if (!Array.isArray(calibrationProcedures.current)) {
				calibrationProcedures.current = [];
			}
			let topMonth;
			let topMonthTotal;
			for (let i = 5; i >= 0; i--) {
				const startDate = new Date(today.getFullYear(), today.getMonth() - i, 1)
				const promise = callApi('get-calibrations-by-month', { start_date: startDate })
					.then(response => {
						if (!topMonthTotal || topMonthTotal < response.length) {
							topMonthTotal = response.length;
							topMonth = monthNames[today.getMonth() - i];
						}
						let calibrationProcedureTotals = []
						for (const calibrationProcedure of calibrationProcedures.current) {
							try {
								calibrationProcedureTotals.push(response.filter(calibrationList => calibrationList.calibration_procedure_id === calibrationProcedure.calibration_procedure_id).length)
							} catch (error) {
								continue
							}
						}
						calibrationProcedureTotals.push(response.length)
						return calibrationProcedureTotals;
					});
				promises.push(promise);
			}
			const sensorsData = await Promise.all(promises);

			setBestMonth(topMonth);
			setBestMonthTotal(topMonthTotal)

			const newDatasets = [];
			for (let i = 0; i < sensorsData[0].length; i++) {
				if (i === sensorsData[0].length - 1) {
					setTotalDataSets([{
						label: 'Total sensors',
						data: [sensorsData[0][i], sensorsData[1][i], sensorsData[2][i], sensorsData[3][i], sensorsData[4][i], sensorsData[5][i]],
						backgroundColor: colors[5],
						borderColor: '#333',
						borderWidth: 1,
						hoverBorderWidth: 2,
						borderRadius: 2,
					}])
				} else {
					newDatasets.push(
						{
							label: `CP ${i + 1}: ${calibrationProcedures.current[i].calibration_procedure.replace(', 3-Set Points', '').replace('Monnit ', '')}`,
							data: [sensorsData[0][i], sensorsData[1][i], sensorsData[2][i], sensorsData[3][i], sensorsData[4][i], sensorsData[5][i]],
							backgroundColor: colors[i],
							borderColor: '#333',
							borderWidth: 1,
							hoverBorderWidth: 2,
							borderRadius: 2,
						}
					)
				}
			}
			setDataSets(newDatasets);
			setTotalSensors(sensorsData);
		};

		if (totalSensors.length === 0) {
			fetchData();
		}
	}, [datasets, monthNames, totalSensors]);

	const byProcedureOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			datalabels: {
				anchor: 'end',
				align: 'top',
				offset: -5,
				formatter: function (value) {
					return value > 0 ? value : ''
				},
			},
			legend: {
				display: false,
			},
			title: {
				display: true,
				text: 'Sensors Calibrated By Procedure',
			},
		},
	};

	const totalOptions = JSON.parse(JSON.stringify(byProcedureOptions)); // Deep copy byProcedureOptions

	totalOptions.plugins.title.text = 'Total Sensors Calibrated';

	const labels = [
		monthNames[new Date(today.getFullYear(), today.getMonth() - 5, 1).getMonth()],
		monthNames[new Date(today.getFullYear(), today.getMonth() - 4, 1).getMonth()],
		monthNames[new Date(today.getFullYear(), today.getMonth() - 3, 1).getMonth()],
		monthNames[new Date(today.getFullYear(), today.getMonth() - 2, 1).getMonth()],
		monthNames[new Date(today.getFullYear(), today.getMonth() - 1, 1).getMonth()],
		monthNames[new Date(today.getFullYear(), today.getMonth(), 1).getMonth()]
	]

	const byProcedure6MonthData = {
		labels,
		datasets: datasets,
	}

	const total6MonthData = {
		labels,
		datasets: totalDataSets,
	}

	if (totalDataSets.length === 0) {
		return (
			<>
				<br />
				<br />
				<h1 className={styles.title}>Loading...</h1>
			</>
		)
	}

	return (
		<div data-testid='graphs'>
			<script src="chartjs-plugin-datalabels.js"></script>
			<div className={styles.graph_grid}>
				<div className={styles.metrics_header}>
					<div className={styles.metrics_text_grid}>

						<h3 className={styles.default_text}>
							<div className={styles.metrics_text_container}>
								<div className={styles.float_left}>Best month:</div>
								<div className={styles.float_right}>{bestMonth} ({bestMonthTotal})</div>
							</div>
						</h3>

						<h3 className={styles.default_text}>
							<div className={styles.metrics_text_container}>
								<div className={styles.float_left}>Next order due:</div>
								<div className={styles.float_right}>{nextOrderDue}</div>
							</div>
						</h3>

						<h3 className={styles.default_text}>
							<div className={styles.metrics_text_container}>
								<div className={styles.float_left}>Sensors in lab:</div>
								<div className={styles.float_right}>{activeSensors}</div>
							</div>
						</h3>

						<h3 className={styles.default_text}>
							<div className={styles.metrics_text_container}>
								<div className={styles.float_left}>Sensors ready to calibrate:</div>
								<div className={styles.float_right}>{sensorsInReceiving}</div>
							</div>
						</h3>

						<h3 className={styles.default_text}>
							<div className={styles.metrics_text_container}>
								<div className={styles.float_left}>Sensors in progress:</div>
								<div className={styles.float_right}>{activeSensors - sensorsInReceiving - sensorsInShipping || 0}</div>
							</div>
						</h3>

						<h3 className={styles.default_text}>
							<div className={styles.metrics_text_container}>
								<div className={styles.float_left}>Sensors ready to ship:</div>
								<div className={styles.float_right}>{sensorsInShipping}</div>
							</div>
						</h3>

					</div>
				</div>
				<div className={styles.graph_tile}>
					<Bar options={byProcedureOptions} data={byProcedure6MonthData} />
				</div>
				<div className={styles.graph_tile}>
					<Bar options={totalOptions} data={total6MonthData} />
				</div>
			</div>
		</div>
	);
}

export default Metrics;
