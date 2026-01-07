export default function formatKey(key) {
    const abbreviations = ["id", "sku"];
    return key
        .split("_")
        .map((word) =>
            abbreviations.includes(word.toLowerCase())
                ? word.toUpperCase()
                : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(" ");
};