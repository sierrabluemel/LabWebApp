import { useEffect, useRef } from 'react';
import styles from '../../styles/styles.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from "../../contexts/app";
import SearchBar from './SearchBar';

function Header({ title }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { technician, setTechnician, setTechnicianId } = useAppContext();
    const isMounted = useRef(false);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user && location.pathname !== '/signIn') {
            navigate('/signIn');
        } else if (!isMounted.current && user) {
            setTechnician(user);
            setTechnicianId(user.technician_id);
            isMounted.current = true;
            navigate('/');
        }
    }, [location.pathname, navigate, setTechnician, setTechnicianId]);

    const logOut = () => {
        setTechnician({});
        setTechnicianId(0);
        navigate('/signIn');
    };

    return (
        <header className={styles.header_container}>
            {/* Left side */}
            <div className={styles.header_left}>
                <button
                    className={styles.home_button}
                    onClick={() => navigate('/')}
                />
            </div>

            {/* Center */}
            <div className={styles.header_center}>
                <h1 className={styles.main_header}>{title || 'Default Title'}</h1>
                <SearchBar />
            </div>

            {/* Right side */}
            <div className={styles.header_right}>
                <div className={styles.technician_name}>
                    Hello {technician.first_name || 'User'}!
                </div>
                <button
                    className={styles.sign_in_button}
                    onClick={logOut}
                >
                    Sign Out
                </button>
            </div>
        </header>
    );
}

export default Header;
