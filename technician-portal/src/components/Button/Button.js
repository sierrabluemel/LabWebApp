import { useState } from "react"
import styles from '../../styles/styles.module.css'

export default function Button({ onClick, innerText, className = styles.default_button, loadingText = 'Loading...' }) {
    const [buttonText, setButtonText] = useState(innerText)

    async function handleClick(event) {
        event.preventDefault();
        setButtonText(loadingText);
        await onClick()
        setButtonText(innerText);
    }

    return (
        <button className={className} onClick={handleClick}>
            {buttonText}
        </button>
    )
}