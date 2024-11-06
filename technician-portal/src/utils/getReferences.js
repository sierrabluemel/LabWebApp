import getEquipment from "./getEquipment";


export default function getReferences(calibrationProcedureId) {
    const references = getEquipment()
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
                    return [
                        equipment.superDaq,
                        equipment.reference2
                    ]
                case 3:
                case 5:
                    return [
                        equipment.rotronic
                    ]
            }
        })

    return references;
}