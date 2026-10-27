import { useCallback, useEffect } from 'react';
import styles from '../../styles/styles.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from "../../contexts/app";
import SearchBar from './SearchBar';
import NotificationCenter from './NotificationCenter';

function Header({ title }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { technician, setTechnician, setTechnicianId } = useAppContext();
    const logOut = useCallback(() => {
        setTechnician({});
        setTechnicianId(0);
        localStorage.clear('user')
        localStorage.clear('jwt')
        localStorage.clear('refresh')
        navigate('/signIn')
    }, [navigate, setTechnician, setTechnicianId]);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user && location.pathname !== '/signIn') {
            logOut()
        }
    }, [location.pathname, logOut]);

    return (
        <header className={styles.header_container}>
            <div className={styles.header_left}>
                <button
                    className={styles.home_button}
                    onClick={() => navigate('/')}
                />
            </div>
            <div className={styles.header_center}>
                <h1 className={styles.main_header}>{title || 'Default Title'}</h1>
                {technician.first_name ? <SearchBar /> : <></>}
            </div>

            <div className={styles.header_right}>
                {technician.first_name &&
                    <>
                        <NotificationCenter />
                        <div className={styles.technician_name}>
                            Hello {technician.first_name || 'User'}!
                        </div>
                        <button
                            className={styles.sign_in_button}
                            onClick={logOut}
                        >
                            Sign Out
                        </button>
                    </>}
            </div>
        </header>
    );
}

export default Header;
