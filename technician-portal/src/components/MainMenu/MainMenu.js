import { useLocation } from "react-router-dom";
import Metrics from "../Metrics/Metrics";
import { useEffect, useState } from "react";
import getEquipment from "../../utils/getEquipment";
import parseDataBaseDate from "../../utils/parseDataBaseDate";
import ConfirmationPopup from "../ConfirmationPopup/ConfirmationPopup";
import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";


function MainMenu() {
    const location = useLocation()
    const [equipmentOutOfCalibration, setEquipmentOutOfCalibration] = useState([])
    const [warned, setWarned] = useState(false)
    const { equipment } = useAppContext()

    useEffect(() => {
        if (warned) {
            return;
        }
        callApi('get-equipment')
            .then(response => {
                equipment.current = response;
            })

        getEquipment()
            .then(equipmentObject => {
                const now = new Date()
                const keys = Object.keys(equipmentObject)
                const badEquipment = []
                for (const key of keys) {
                    const equipment = equipmentObject[key]
                    if (new Date(equipment.next_calibration) < now) {
                        badEquipment.push(`${equipment.asset_tag} (${equipment.description}) is out of calibration as of ${parseDataBaseDate(equipment.next_calibration)}`)
                    }
                }
                if (badEquipment.length > 0) {
                    setEquipmentOutOfCalibration(['EQUIPMENT OUT OF CALIBRATION', ...badEquipment]);
                }
                setWarned(true);
            })
    })

    if (location.pathname !== '/') {
        return;
    }

    return (
        <>
            {equipmentOutOfCalibration.length === 0 ? <></> : <ConfirmationPopup confirmationArray={equipmentOutOfCalibration} setConfirmationArray={setEquipmentOutOfCalibration} handleConfirm={() => equipmentOutOfCalibration.current = []} />}
            <Metrics />
        </>
    );
}

export default MainMenu;