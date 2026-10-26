import React, { useRef, useState } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { AppWrapper } from './contexts/app';

import BatchEntry from './components/BatchEntry/BatchEntry';
import ConfirmationScreen from './components/ConfirmationScreen/ConfirmationScreen';
import ErrorMessage from './components/ErrorMessage/ErrorMessage';
import Header from './components/Header/Header';
import LabView from './components/LabView/LabView';
import MainMenu from './components/MainMenu/MainMenu';
import ManageBatch from './components/ManageBatch/ManageBatch';
import Metrics from './components/Metrics/Metrics';
import NavigationMenu from './components/NavigationMenu.js/NavigationMenu.js';
import OrderEntry from './components/OrderEntry/OrderEntry';
import PageNotFound from './components/PageNotFound/PageNotFound';
import SalesOrderForm from './components/SalesOrderForm/SalesOrderForm';
import Shipping from './components/Shipping/Shipping';
import SignInMenu from './components/SignInMenu/SignInMenu';

import styles from './styles/styles.module.css';
import Admin from './components/Admin/Admin.js';
import SearchResults from './components/SearchResults/SearchResults.js';

function App() {
  const [salesOrder, setSalesOrder] = useState('');
  const [technicianId, setTechnicianId] = useState(0);
  const [technician, setTechnician] = useState({});
  const [batchNumber, setBatchNumber] = useState('');
  const [sensorList, setSensorList] = useState([]);
  const [procedureId, setProcedureId] = useState(0);
  const [confirmationMessage, setConfirmationMessage] = useState('Success!');
  const [popupMessage, setPopupMessage] = useState('');
  const [order, setOrder] = useState(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [batches, setBatches] = useState([]);
  const [sensorGrid, setSensorGrid] = useState([]);
  const [expedited, setExpedited] = useState(false);
  const [searchSelection, setSearchSelection] = useState(null)
  const variances = useRef([]);
  const equipment = useRef({});
  const [labReadings, setLabReadings] = useState({})
  const [equipmentList, setEquipmentList] = useState([]);
  const [customerOrderNumber, setCustomerOrderNumber] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const banner = process.env.REACT_APP_STATUS !== 'production' && <div className={styles.dev_banner}>Development Environment</div>

  return (
    <div className={`${styles.App} ${banner ? styles.has_banner : ''}`}>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
      <AppWrapper
        sharedState={{
          batchNumber, setBatchNumber,
          salesOrder, setSalesOrder,
          technicianId, setTechnicianId,
          technician, setTechnician,
          confirmationMessage, setConfirmationMessage,
          popupMessage, setPopupMessage,
          order, setOrder,
          sensorList, setSensorList,
          procedureId, setProcedureId,
          sensorGrid, setSensorGrid,
          orderNumber, setOrderNumber,
          batches, setBatches,
          expedited, setExpedited,
          equipmentList, setEquipmentList,
          labReadings, setLabReadings,
          searchSelection, setSearchSelection,
          customerOrderNumber, setCustomerOrderNumber,
          variances, equipment,
          notifications, setNotifications
        }}
      >
        <Router>
          {banner}

          <Header title='Technician Portal' />
          <div className={styles.main_body}>
            <NavigationMenu />
            <div className={styles.display_area}>
              <ErrorMessage />
              <Routes>
                <Route path='/' element={<MainMenu />} />
                <Route path='/batchEntry' element={<BatchEntry />} />
                <Route path='/confirmation' element={<ConfirmationScreen />} />
                <Route path='/createSalesOrder' element={<SalesOrderForm />} />

                <Route path='/manageBatch' element={<ManageBatch />} />
                <Route path='/metrics' element={<Metrics />} />
                <Route path='/orderEntry' element={<OrderEntry />} />

                <Route path='/shipping' element={<Shipping />} />
                <Route path='/signIn' element={<SignInMenu />} />

                <Route path='/admin' element={technician.admin ? <Admin /> : <Navigate to='/' replace />} />

                <Route path='/search' element={<SearchResults />} />

                <Route path='*' element={<PageNotFound />} />
              </Routes>
            </div>
            {technicianId ? <LabView /> : <></>}
          </div>
        </Router>
      </AppWrapper>
    </div >
  );
}

export default App;