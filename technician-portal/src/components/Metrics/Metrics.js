/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-loop-func */
import { useState, useEffect, useRef } from 'react';
import { Chart, CategoryScale, LinearScale, BarElement, LineController, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';
import styles from "../../styles/styles.module.css";
import callApi from '../../utils/api/callApi';
import addWorkDays from '../../utils/addWorkDays';
import { useAppContext } from '../../contexts/app';

Chart.register(
	CategoryScale, LinearScale, BarElement, LineController, LineElement, PointElement,
	Title, Tooltip, Legend, ChartDataLabels
);

// calibrated matches --primary, failures is the saturated twin of --cal-1, rate stays neutral so it doesn't compete with the bars
const COLORS = { calibrated: '#3b6ea5', failures: '#d9636e', rate: '#333' };
// saturated twins of the --cal-1..8 CP badge colors, indexed by calibration_procedure_id - 1
const PROCEDURE_COLORS = ['#d9636e', '#4f86c6', '#d9b13b', '#d98b5f', '#4fa872', '#8a6fbf', '#3fa3ad', '#c96a9e'];

function Metrics() {
	const today = new Date();
	const calibrationProcedures = useRef([]);
	const [charts, setCharts] = useState(null); // { calibrated: { total, byProcedure }, failures: { total, byProcedure } }
	const [view, setView] = useState('total');
	const [activeSensors, setActiveSensors] = useState(0);
	const [nextOrderDue, setNextOrderDue] = useState({});
	const [nextOrderDueClass, setNextOrderDueClass] = useState('');
	const [bestMonth, setBestMonth] = useState('');
	const [bestMonthTotal, setBestMonthTotal] = useState(0);
	const [sensorsInReceiving, setSensorsInReceiving] = useState(0);
	const [sensorsInShipping, setSensorsInShipping] = useState(0);
	const isMounted = useRef(false);

	const { setEquipmentList } = useAppContext()

	const monthNames = [
		"January", "February", "March", "April", "May", "June", "July",
		"August", "September", "October", "November", "December"
	];

	useEffect(() => {
		if (isMounted.current)
			return

		callApi('get-equipment')
			.then(equipment => {
				setEquipmentList(equipment);
			})

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
						spanClass = styles.soft_bad;
					} else if (addWorkDays(new Date(), 3) < dueDate) {
						spanClass = styles.soft_good;
					} else {
						spanClass = styles.soft_warn;
					}
					setNextOrderDue({ date: `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`, order: orderDue });
					setNextOrderDueClass(spanClass);
					setSensorsInReceiving(sensorsToTest);
					setSensorsInShipping(sensorsToShip);
				})

			const promises = [];
			calibrationProcedures.current = await callApi('get-calibration-procedures')
			if (!Array.isArray(calibrationProcedures.current)) {
				calibrationProcedures.current = [];
			}
			let topMonth;
			let topMonthTotal;
			// [...count per procedure, total]
			const countByProcedure = (list) => [
				...calibrationProcedures.current.map(cp => list.filter(c => c.calibration_procedure_id === cp.calibration_procedure_id).length),
				list.length
			];
			for (let i = 5; i >= 0; i--) {
				const startDate = new Date(today.getFullYear(), today.getMonth() - i, 1)
				const promise = callApi('get-calibrations-by-month', { start_date: startDate })
					.then(response => {
						const calibrations = response.calibrations ?? [];
						if (!topMonthTotal || topMonthTotal < calibrations.length) {
							topMonthTotal = calibrations.length;
							topMonth = monthNames[today.getMonth() - i];
						}
						const calibrated = countByProcedure(calibrations), failures = countByProcedure(response.failures ?? []);
						// failures per 100 calibrated sensor-days; a sensor failing twice in a day counts twice
						return { calibrated, failures, rate: calibrated.map((c, i) => c ? Math.round(100 * failures[i] / c) : 0) };
					});
				promises.push(promise);
			}
			const monthsData = await Promise.all(promises);

			setBestMonth(topMonth);
			setBestMonthTotal(topMonthTotal)

			// monthsData[m][key] is [...per procedure, total]. Total view: one series per month. By procedure: one series per procedure, still by month.
			const totalIndex = calibrationProcedures.current.length;
			const byProcedure = (key) => calibrationProcedures.current.map((cp, i) => ({
				label: `CP ${cp.calibration_procedure_id}`, // short so eight legend entries fit on one line; the full name shows in the tooltip
				fullName: cp.calibration_procedure.replace(', 3-Set Points', '').replace('Monnit ', ''),
				data: monthsData.map(m => m[key][i]),
				backgroundColor: PROCEDURE_COLORS[(cp.calibration_procedure_id - 1) % PROCEDURE_COLORS.length],
				// wider bars than chart.js defaults (0.9 / 0.8) so the value labels fit with 8 bars per month
				barPercentage: 1, categoryPercentage: 0.95,
			}));
			setCharts({
				labels: [5, 4, 3, 2, 1, 0].map(i => monthNames[new Date(today.getFullYear(), today.getMonth() - i, 1).getMonth()].slice(0, 3)),
				total: {
					calibrated: monthsData.map(m => m.calibrated[totalIndex]),
					failures: monthsData.map(m => m.failures[totalIndex]),
					rate: monthsData.map(m => m.rate[totalIndex]),
				},
				byProcedure: { calibrated: byProcedure('calibrated'), failures: byProcedure('failures') },
			});
		};

		fetchData();
	}, []);

	if (!charts) {
		return (
			<>
				<h1 className={styles.title}>Loading...</h1>
			</>
		)
	}

	const barStyle = { borderColor: '#333', borderWidth: 1, hoverBorderWidth: 2, borderRadius: 2 };
	const chartOptions = (title, legend, extraScales = {}) => ({
		responsive: true,
		maintainAspectRatio: false,
		scales: { y: { beginAtZero: true }, ...extraScales },
		plugins: {
			datalabels: { anchor: 'end', align: 'top', offset: -5, formatter: value => value > 0 ? value : '' },
			legend: { display: legend, position: 'bottom' },
			title: { display: true, text: title },
			tooltip: { callbacks: { label: item => `${item.dataset.fullName ?? item.dataset.label}: ${item.formattedValue}` } },
		},
	});

	// Total view: calibrated and failure bars side by side, failure rate as a line on a right-hand percent axis
	const totalDatasets = [
		{ ...barStyle, label: 'Total sensors', data: charts.total.calibrated, backgroundColor: COLORS.calibrated, order: 1 }, // order 1 draws under the line
		{ ...barStyle, label: 'Total failures', data: charts.total.failures, backgroundColor: COLORS.failures, order: 1 },
		{
			label: 'Failure rate', data: charts.total.rate, type: 'line', yAxisID: 'y1', order: 0,
			borderColor: COLORS.rate, backgroundColor: COLORS.rate, borderWidth: 2, tension: 0.3, pointRadius: 4,
			datalabels: {
				color: '#fff', backgroundColor: COLORS.rate, borderRadius: 3, padding: { top: 2, bottom: 1, left: 4, right: 4 },
				font: { weight: 'bold' }, offset: 4, formatter: v => v + '%',
			},
		},
	];
	const totalOptions = chartOptions('Calibrations and failures by month', true, {
		y1: { position: 'right', beginAtZero: true, grace: '25%', grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } },
	});
	const byProcedureDatasets = (key) => charts.byProcedure[key].map(d => ({ ...barStyle, ...d }));

	return (
		<div data-testid='graphs'>
			<script src="chartjs-plugin-datalabels.js"></script>
			<div className={styles.graph_grid}>
				<div className={styles.metrics_header}>
					<div className={styles.kpi_grid}>
						{[
							['Best month', `${bestMonth} (${bestMonthTotal})`],
							[nextOrderDue.order ? `Next order due (${nextOrderDue.order})` : 'Next order due', nextOrderDue.date, nextOrderDueClass],
							['Sensors in lab', activeSensors],
							['Ready to calibrate', sensorsInReceiving],
							['In progress', activeSensors - sensorsInReceiving - sensorsInShipping || 0],
							['Ready to ship', sensorsInShipping],
						].map(([label, value, statusClass = '']) => (
							<div className={`${styles.kpi_tile} ${statusClass}`} key={label}>
								<div className={styles.kpi_label}>{label}</div>
								<div className={styles.kpi_value}>{value}</div>
							</div>
						))}
					</div>
				</div>
				<div className={styles.graph_toggle} role='group' aria-label='Graph view'>
					{[['total', 'Total'], ['byProcedure', 'By procedure']].map(([key, label]) =>
						<button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
				</div>
				{view === 'total' ?
					<div className={styles.graph_tile}>
						<Bar options={totalOptions} data={{ labels: charts.labels, datasets: totalDatasets }} />
					</div>
					: <>
						<div className={`${styles.graph_tile} ${styles.graph_tile_half}`}>
							<Bar options={chartOptions('Sensors calibrated by procedure', false)} data={{ labels: charts.labels, datasets: byProcedureDatasets('calibrated') }} />
						</div>
						<div className={`${styles.graph_tile} ${styles.graph_tile_half}`}>
							<Bar options={chartOptions('Failures by procedure', true)} data={{ labels: charts.labels, datasets: byProcedureDatasets('failures') }} />
						</div>
					</>}
			</div>
		</div>
	);
}

export default Metrics;
