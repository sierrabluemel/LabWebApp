import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../../contexts/app";
import callApi from "../../utils/api/callApi";
import setBatchLocation from "../../utils/setBatchLocation";

import styles from "../../styles/styles.module.css";

const NEW_LOCATION = 'new';
const STAGES = { R: 'Receiving', T: 'Testing', S: 'Shipping' };

// Splits a stage's locations into one array per shelf row (T-B1, T-B2 -> row B). Named spots like T-AMB go on their own last line.
const shelfRows = (stageLocations) => {
    const rows = {};
    const named = [];
    for (const location of stageLocations) {
        const bin = location.slice(2);
        if (/^[A-Z]\d+$/.test(bin))
            (rows[bin[0]] ??= []).push(location);
        else
            named.push(location);
    }
    const sorted = Object.keys(rows).sort().map(row => rows[row]);
    return named.length ? [...sorted, named] : sorted;
}

// Opens a grid of every location used before, one row per stage. Click a bin, then press Enter to move. "New" allows typing one that isn't listed yet.
function LocationPicker({ batchNumber, onMoved }) {
    const { setPopupMessage, technicianId } = useAppContext();
    const [selected, setSelected] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [locations, setLocations] = useState([]);
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const triggerRef = useRef(null);

    useEffect(() => {
        callApi('get-locations')
            .then(setLocations)
            .catch(err => console.error(err))
    }, []);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target))
                setOpen(false);
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    const move = (location) => {
        // The location is recorded in the first step; the iMonnit steps after it run in the background. Only a failure gets a popup.
        const onRecorded = () => {
            onMoved(location);
            setSelected('');
            setNewLocation('');
            if (!locations.includes(location))
                setLocations([...locations, location].sort());
        }
        setBatchLocation(location, technicianId, batchNumber, onRecorded)
            .then(({ error }) => error && setPopupMessage(error))
            .catch(error => setPopupMessage(`Could not move batch ${batchNumber} to ${location}: ${error?.message ?? 'Unknown error'}`));
    }

    // Enter in the "New location" box moves to the typed location
    const handleSubmit = (event) => {
        event.preventDefault();
        if (newLocation)
            move(newLocation);
    }

    // Clicking a listed bin moves the batch right away; the popup confirms or reports the failure
    const pick = (location) => {
        setSelected(location);
        setOpen(false);
        if (location !== NEW_LOCATION)
            move(location);
    }

    const handleTriggerKeyDown = (event) => {
        if (event.key === 'Escape')
            setOpen(false);
    }

    return (
        <form onSubmit={handleSubmit} data-testid={'locationForm'} className={styles.location_picker} ref={containerRef}>
            <button type='button' ref={triggerRef} className={styles.dropdown} aria-label={'Location'} aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={handleTriggerKeyDown}>
                {selected && selected !== NEW_LOCATION ? selected : 'Move to location...'}
            </button>
            {open &&
                <div className={styles.location_panel} onKeyDown={event => event.key === 'Escape' && setOpen(false)}>
                    {Object.entries(STAGES).map(([letter, stage]) =>
                        <div key={letter} className={`${styles.location_stage} ${styles[`location_stage_${letter}`]}`}>
                            <span className={styles.location_stage_label}>{stage}</span>
                            <div className={styles.location_bins}>
                                {shelfRows(locations.filter(l => l.startsWith(letter))).map(row =>
                                    <div key={row[0]} className={styles.location_shelf}>
                                        {row.map(l =>
                                            <button type='button' key={l} aria-label={l} className={`${styles.location_bin} ${l === selected ? styles.location_bin_selected : ''}`} onClick={() => pick(l)}>
                                                {l.slice(2)}
                                            </button>)}
                                    </div>)}
                            </div>
                        </div>)}
                    <div className={styles.location_stage}>
                        <span className={styles.location_stage_label}></span>
                        <button type='button' className={styles.location_bin} onClick={() => pick(NEW_LOCATION)}>New location...</button>
                    </div>
                </div>}
            {selected === NEW_LOCATION &&
                <input type='text' autoFocus value={newLocation} onChange={event => setNewLocation(event.target.value.toUpperCase())} className={styles.default_text_box} placeholder={'New location'} />}
        </form>
    )
}

export default LocationPicker;
