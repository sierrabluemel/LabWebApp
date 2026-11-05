import styles from "../styles/styles.module.css";

// CSS class for a bin label's color: B-Y21 -> bin_Y (yellow), B-R01 -> bin_R (red), B-B03 -> bin_B (blue)
export default function binClass(bin) {
    return (bin && styles[`bin_${bin[2]}`]) ?? '';
}
