import getEquipment from "./getEquipment";

export default function getReferences(calibrationProcedureId) {
    return getEquipment()
        .then(equipment => {
            switch (calibrationProcedureId) {
                default:
                    return []
                case 1:
                case 6:
                    return [
                        equipment.superDaq,
                        equipment.reference1,
                        equipment.reference2,
                        equipment.reference3
                    ]
                case 2:
                case 4:
                case 7:
                    return [
                        equipment.superDaq,
                        equipment.reference2
                    ]
                case 3:
                case 5:
                case 8:
                    return [
                        equipment.rotronic
                    ]
            }
        })
}