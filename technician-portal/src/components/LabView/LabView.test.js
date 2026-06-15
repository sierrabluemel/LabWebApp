import { screen, render, act } from '@testing-library/react';
import LabView from './LabView';
import mockAxios from 'axios';
import callApi from '../../utils/api/callApi';
import ip from '../../utils/ip/ip';
import { AppWrapper } from '../../contexts/app';

jest.mock('axios');
jest.spyOn(global, 'setTimeout');

beforeEach(() => {
    jest.clearAllMocks()

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-recent-data/`:
                return Promise.resolve({ data: [{ timestamp: new Date().toString() }] })
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: [{ "equipment_id": 10001 }] })
            default:
                return Promise.reject()
        }
    });
})

async function renderScreen() {
    render(
        <AppWrapper sharedState={{ technicianId: 1 }}>
            <LabView />
        </AppWrapper>
    );
    await act(async () => {
        await callApi('get-recent-data');
    });
}


test('LabView renders successfully', async () => {
    await renderScreen()
    const loadingElement = screen.getByText(/loading.../i);
    expect(loadingElement).toBeInTheDocument();
})

it('renders equipment box for each reference', async () => {
    jest.useFakeTimers();

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-recent-data/`:
                return Promise.resolve({
                    data: [{
                        rotronic_data: {
                            S000101: {
                                "Humidity": 91.29,
                                "Temperature": 26.32,
                                "stability_data": {
                                    "humidity": {
                                        "slope": -0.002000000000000076,
                                        "stable": true,
                                        "average": 91.263,
                                        "assumed_set_point": 90,
                                        "standard_deviation": 0.01220514306517505
                                    },
                                    "temperature": {
                                        "slope": 0.00032785309104896,
                                        "stable": false,
                                        "average": 26.328000000000003,
                                        "assumed_set_point": 25,
                                        "standard_deviation": 0.011121068335350679
                                    }
                                }
                            },
                            S000103: {
                                "Humidity": 91.29,
                                "Temperature": 26.32,
                                "stability_data": {
                                    "humidity": {
                                        "slope": -0.002000000000000076,
                                        "stable": true,
                                        "average": 91.263,
                                        "assumed_set_point": 90,
                                        "standard_deviation": 0.01220514306517505
                                    },
                                    "temperature": {
                                        "slope": 0.00032785309104896,
                                        "stable": false,
                                        "average": 26.328000000000003,
                                        "assumed_set_point": 25,
                                        "standard_deviation": 0.011121068335350679
                                    }
                                }
                            },
                        },
                        super_daq_data: {
                            S000138: {
                                "Humidity": 91.29,
                                "Temperature": 26.32,
                                "stability_data": {
                                    "humidity": {
                                        "slope": -0.002000000000000076,
                                        "stable": true,
                                        "average": 91.263,
                                        "assumed_set_point": 90,
                                        "standard_deviation": 0.01220514306517505
                                    },
                                    "temperature": {
                                        "slope": 0.00032785309104896,
                                        "stable": false,
                                        "average": 26.328000000000003,
                                        "assumed_set_point": 25,
                                        "standard_deviation": 0.011121068335350679
                                    }
                                }
                            },
                        }
                    }]
                })
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({
                    data: [
                        {
                            "asset_tag": "S000101",
                        },
                        {
                            "asset_tag": "S000103",
                        },
                        {
                            "asset_tag": "S000138",
                        },
                        {
                            "asset_tag": "S000111",
                        }
                    ]
                })
            default:
                return Promise.reject()
        }
    });
    await renderScreen();

    await act(async () => {
        jest.advanceTimersByTime(3000);
    })

})

test('status_dot on render has status_dot_red class', async () => {
    await renderScreen()
    const aggregatorStatus = screen.getByTestId('statusDot')
    expect(aggregatorStatus).toHaveClass('status_dot_red')
})

test('status_dot with recent timestamp should be green', async () => {
    jest.useFakeTimers();
    await renderScreen();

    await act(async () => {
        jest.advanceTimersByTime(3000);
    })

    const aggregatorStatus = screen.getByTestId('statusDot');
    expect(aggregatorStatus).toHaveClass('status_dot_green');
})

test('status_dot with 60 second timestamp should be yellow', async () => {
    jest.useFakeTimers();

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-recent-data/`:
                let timestamp = new Date()
                timestamp = timestamp.setHours(timestamp.getHours())
                return Promise.resolve({ data: [{ timestamp: (timestamp - 60000) }] })
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: [{ "equipment_id": 10001 }] })
            default:
                return Promise.reject()
        }
    });
    await renderScreen();

    await act(async () => {
        jest.advanceTimersByTime(3000);
    })

    const aggregatorStatus = screen.getByTestId('statusDot');
    expect(aggregatorStatus).toHaveClass('status_dot_yellow');
})

test('status_dot with 130 second timestamp should be red', async () => {
    jest.useFakeTimers();

    mockAxios.get.mockImplementation(url => {
        switch (url) {
            case `http://${ip}/api/get-recent-data/`:
                let timestamp = new Date()
                timestamp = timestamp.setHours(timestamp.getHours())
                return Promise.resolve({ data: [{ timestamp: (timestamp - 130000) }] })
            case `http://${ip}/api/get-equipment/`:
                return Promise.resolve({ data: [{ "equipment_id": 10001 }] })
            default:
                return Promise.reject()
        }
    });
    await renderScreen();

    await act(async () => {
        jest.advanceTimersByTime(3000);
    })

    const aggregatorStatus = screen.getByTestId('statusDot');
    expect(aggregatorStatus).toHaveClass('status_dot_red');
})
