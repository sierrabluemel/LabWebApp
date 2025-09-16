export function isNullOrEmpty(text: string) {
    return text == undefined || text == null || text == "";
}

export function parseIntNullable(text: string) {
    let parsed = parseInt(text);
    return isNaN(parsed) ? null : parsed;
}