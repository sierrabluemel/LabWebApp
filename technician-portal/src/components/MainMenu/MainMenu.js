import { useLocation } from "react-router-dom";
import Metrics from "../Metrics/Metrics";


function MainMenu() {
    const location = useLocation()
    if (location.pathname !== '/') {
        return;
    }

    return (
        <Metrics />
    );
}

export default MainMenu;