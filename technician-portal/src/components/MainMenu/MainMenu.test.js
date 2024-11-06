/* eslint-disable testing-library/no-unnecessary-act */
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MainMenu from './MainMenu';
import mockAxios from 'axios';
import ip from '../../utils/ip/ip';
import { act } from 'react-dom/test-utils';
import { AppWrapper } from '../../contexts/app';

const equipment = require('../../utils/equipment.test.json')

jest.mock('axios');
jest.mock('react-chartjs-2', () => ({
  Bar: () => null
}));

beforeEach(() => {
  jest.clearAllMocks()

  mockAxios.get.mockImplementation(url => {
    switch (url) {
      case `http://${ip}/api/get-calibrations-by-month/`:
        return Promise.resolve({ data: [{ order_id: 10000, calibration_procedure_id: 1 }, { order_id: 10001, calibration_procedure_id: 2 }] })
      case `http://${ip}/api/get-equipment/`:
        return Promise.resolve({ data: equipment })
      case `http://${ip}/api/get-active-sensors/`:
        return Promise.resolve({ data: [{ sensor_id: 10000, current_location: 'S-C1' }, { sensor_id: 10001, current_location: 'R-C1' }] })
      case `http://${ip}/api/get-calibration-procedures/`:
        return Promise.resolve({ data: [{ "calibration_procedure_id": 1, "calibration_procedure": "Monnit Standard Temperature Calibration, 3-Set Points, Leaded, Submersible" }, { "calibration_procedure_id": 2, "calibration_procedure": "Monnit Low Temperature Calibration, 3-Set Points, Leaded, Submersible" }, { "calibration_procedure_id": 3, "calibration_procedure": "Monnit Humidity and Temperature Calibration" }, { "calibration_procedure_id": 4, "calibration_procedure": "Monnit Temperature Calibration, 3-Set Points, Dry" }, { "calibration_procedure_id": 5, "calibration_procedure": "Monnit Temperature Calibration in Climate Controlled Chamber" }] })
      default:
        return Promise.reject()
    }
  });
})

test('MainMenu renders successfully', async () => {
  const context = {
    equipment: {
      current: {}
    },
    equipmentList: {
      current: []
    }
  };
  await act(async () => {
    render(
      <MemoryRouter>
        <AppWrapper sharedState={context}>
          <MainMenu />
        </AppWrapper>
      </MemoryRouter>
    );
  })
});