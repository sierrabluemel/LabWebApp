/* eslint-disable react-hooks/exhaustive-deps */
import styles from "../../styles/styles.module.css";
import { useEffect, useState } from "react";
import { useAppContext } from "../../contexts/app";
import axios from "axios";
import ip from "../../utils/ip/ip";
import { useNavigate } from "react-router-dom";
import callApi from "../../utils/api/callApi";

const FORM_VALUES = [
  {
    title: "Email Address",
    type: "email",
    key: "email",
  },
  {
    title: "Password",
    type: "password",
    key: "password"
  },
];

function SignInMenu() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setPopupMessage, setTechnicianId, setTechnician } = useAppContext();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = { email: email, password: password };
    setPopupMessage(null)
    let error = ""

    FORM_VALUES.map(formItem => {
      if (!form[formItem.key]) {
        error = `${formItem.title} is required`;
      }
      return error;
    })

    if (error) {
      setPopupMessage(error)
      return
    }

    const url = process.env.REACT_APP_STATUS === 'production' ? `https://${ip}/api/auth/sign-in` : `http://${ip}/api/auth/sign-in`;
    axios.post(url, form, {})
      .then((response) => {
        console.log(response.data)
        localStorage.setItem("jwt", response.data["access-token"]);
        login(response.data.id);
      })
      .catch((error) => {
        const errorMessageRaw = error.response
        const errorMessage = errorMessageRaw?.data.error

        setPopupMessage(errorMessage);
      });
  }

  function login(userId) {
    callApi('lookup-technician', { user_id: userId })
      .then(technician => {
        if (!technician || !technician.technician_id) {
          setPopupMessage('It looks like there is no technician profile connected with that account. If you believe this is an error, please contact your manager.')
        }
        setTechnicianId(technician.technician_id);
        setTechnician(technician);
        localStorage.setItem('user', JSON.stringify(technician))
        navigate('/');
      })
  }

  useEffect(() => {
    const loggedInUser = localStorage.getItem('user');
    if (loggedInUser) {
      const foundUser = JSON.parse(loggedInUser);
      login(foundUser.user_id)
    }
  }, [login]);

  return (
    <div className={styles.sign_in_menu}>
      <div className={styles.menu}>
        <form onSubmit={handleSubmit}>
          <input type='text' value={email} onChange={e => setEmail(e.target.value)} className={styles.default_text_box} placeholder={'Email'} />
          <input type='password' value={password} onChange={e => setPassword(e.target.value)} className={styles.default_text_box} placeholder={'Password'} />
          <input type='submit' className={styles.default_button} value={'Log in'}></input>
        </form>
      </div>
    </div>
  )
}

export default SignInMenu;