import { React, useEffect, useRef } from 'react';
import styles from '../../styles/styles.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from "../../contexts/app";

function Header({ title }) {
  let location = useLocation();
  let navigate = useNavigate();
  const { technician, setTechnician, setTechnicianId } = useAppContext();
  const isMounted = useRef(false)

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'))
    if (!user && location.pathname !== '/signIn') {
      navigate('/signIn');
    } else if (isMounted.current === false && user) {
      setTechnician(user);
      setTechnicianId(1);
      isMounted.current = true;
      navigate('/');
    }
  })

  const handleSubmit = () => {
    setTechnician({});
    setTechnicianId(0);
    localStorage.clear('user')
    navigate('/signIn')
  }
  return (
    <>
      <header>
        <h1 className={styles.main_header}>{title ? title : 'Default title'}</h1>
        <button className={styles.home_button} onClick={() => navigate('/')}></button>

        <div className={styles.sign_in_container}>
          {technician.technician_id ?
            <>
              <div className={styles.technician_name}>Hello {technician.first_name}!</div>
              <button className={styles.sign_in_button} onClick={handleSubmit}>Sign Out</button>
            </> : <></>}
        </div>
      </header>
    </>
  );
}

export default Header;