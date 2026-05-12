import './Switch.css';

const Switch = ({ isOn, handleToggle, id }) => {
    return (
        <div>
            <input
                checked={isOn}
                onChange={handleToggle}
                className="react-switch-checkbox"
                id={id}
                type="checkbox"
            />
            <label
                style={{ background: isOn && '#08afe6' }}
                className="react-switch-label"
                htmlFor={id}
            >
                <span className={`react-switch-button`} />
            </label>
        </div>
    );
};

export default Switch;