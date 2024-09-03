import callApi from "./api/callApi";

async function getEquipment() {
    const equipmentList = await callApi('get-equipment');
    const bath1 = equipmentList.filter(equipment => equipment.asset_tag === 'S000101')[0];
    const bath2 = equipmentList.filter(equipment => equipment.asset_tag === 'S000102')[0];
    const bath3 = equipmentList.filter(equipment => equipment.asset_tag === 'S000103')[0];
    const chamber = equipmentList.filter(equipment => equipment.asset_tag === 'S000105')[0];
    const equipment = {
        bath1: bath1,
        bath2: bath2,
        bath3: bath3,
        chamber: chamber,
        reference1: equipmentList.filter(equipment => equipment.asset_tag === bath1.reference_tag)[0],
        reference2: equipmentList.filter(equipment => equipment.asset_tag === bath2.reference_tag)[0],
        reference3: equipmentList.filter(equipment => equipment.asset_tag === bath3.reference_tag)[0],
        superDaq: equipmentList.filter(equipment => equipment.reference_tag === equipment.asset_tag)[0],
        rotronic: equipmentList.filter(equipment => equipment.asset_tag === chamber.reference_tag)[0],
    }
    return equipment;
}

export default getEquipment;