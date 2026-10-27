import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../contexts/app";
import formatKey from "../../utils/formatKey";
import callApi from "../../utils/api/callApi";
import styles from "../../styles/styles.module.css";

// Also the order the result groups are shown in
const SEARCH_KEYS = ["customer_order_number", "order_id", "batch_id", "sensor_id", "cable_id", "certificate_id"];
const MAX_RESULTS_PER_GROUP = 10;

export default function SearchBar() {
    const [searchData, setSearchData] = useState([]);
    const [searchableEntries, setSearchableEntries] = useState([]);
    const [searchString, setSearchString] = useState("");
    const [filteredResults, setFilteredResults] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [hoverIndex, setHoverIndex] = useState(-1);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const isMounted = useRef(false);
    const containerRef = useRef(null);

    const DEBOUNCE_DELAY = 250;
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const { setSearchSelection } = useAppContext()

    // Fetch data on mount, and again on every focus so orders and batches created since then show up
    const loadSearchData = useCallback(() => {
        callApi("search-data", {})
            .then((response) => {
                setSearchData(response || []);
            })
            .catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            loadSearchData();
        }
    }, [loadSearchData]);

    // Close the dropdown on any click outside the search bar; the typed text is kept for when it reopens on focus
    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target))
                setDropdownOpen(false);
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    // Flatten data into one entry per distinct key/value; search-data is one row per sensor, so order and batch ids repeat a lot
    useEffect(() => {
        const seen = new Set();
        const entries = [];
        searchData.forEach((row) => {
            SEARCH_KEYS.forEach((key) => {
                const value = row[key];
                if (value === undefined || value === null) return;
                const searchableText = String(value).trim().toLowerCase();
                if (!searchableText || seen.has(`${key}:${searchableText}`)) return;
                seen.add(`${key}:${searchableText}`);
                entries.push({ key, value, searchableText });
            });
        });
        setSearchableEntries(entries);
    }, [searchData]);

    const handleInputChange = (event) => {
        setSearchString(event.target.value);
        setActiveIndex(-1);
        setDropdownOpen(true);
    };

    // Debounced search
    useEffect(() => {
        const incrementalSearch = (value) => {
            const keywords = value.split(" ").filter((k) => k.length > 0);
            if (!keywords.length || !searchableEntries.length) {
                setFilteredResults([]);
                return;
            }

            // 0 = exact, 1 = starts with, 2 = contains; best keyword wins
            const rank = (text) => Math.min(...keywords.map((k) => (text === k ? 0 : text.startsWith(k) ? 1 : 2)));

            // Every keyword must match, so extra words narrow the results
            const grouped = {};
            searchableEntries.forEach((entry) => {
                if (!keywords.every((k) => entry.searchableText.includes(k))) return;
                if (!grouped[entry.key]) grouped[entry.key] = [];
                grouped[entry.key].push({ entry, rank: rank(entry.searchableText) });
            });

            // Best matches first, shorter ids before longer ones (1, 10..19, 100..), capped per group
            const sortedResults = SEARCH_KEYS
                .filter((k) => grouped[k])
                .map((k) => ({
                    key: k,
                    hiddenCount: Math.max(grouped[k].length - MAX_RESULTS_PER_GROUP, 0),
                    values: grouped[k]
                        .sort((a, b) =>
                            a.rank - b.rank
                            || a.entry.searchableText.length - b.entry.searchableText.length
                            || a.entry.searchableText.localeCompare(b.entry.searchableText))
                        .slice(0, MAX_RESULTS_PER_GROUP)
                        .map(({ entry }) => ({ key: entry.key, value: entry.value, highlightedValue: entry.value })),
                }));

            setFilteredResults(sortedResults);
        };
        if (!searchString) {
            setFilteredResults([]);
            return;
        }
        const handler = setTimeout(() => {
            incrementalSearch(searchString.toLowerCase());
        }, DEBOUNCE_DELAY);

        return () => clearTimeout(handler);
    }, [searchString, searchableEntries]);

    const flatResults = useMemo(() => filteredResults.flatMap((g) => g.values), [filteredResults]);

    // Compute highlightedValue lazily for visible items
    const getHighlightedValue = (text) => {
        if (!searchString) return text;
        const keywords = searchString
            .split(" ")
            .map((k) => k.trim())
            .filter((k) => k.length > 0);

        if (!keywords.length) return text;

        const str = String(text ?? "");
        const safeKeywords = keywords.map((kw) =>
            kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        );
        const regex = new RegExp(safeKeywords.join("|"), "gi");
        const parts = str.split(regex);
        const matches = str.match(regex);
        if (!matches) return str;

        const highlighted = [];
        parts.forEach((part, index) => {
            highlighted.push(part);
            if (index < matches.length) highlighted.push(<mark key={index}>{matches[index]}</mark>);
        });
        return highlighted;
    };

    const handleResultClick = (result) => {
        setSearchSelection(result);
        setSearchString("");
        setFilteredResults([]);
        setActiveIndex(-1);
        navigate('/search')
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            setDropdownOpen(false);
            return;
        }
        if (!flatResults.length) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIndex >= 0) handleResultClick(flatResults[activeIndex]);
        }
    };

    // Scroll active item into view
    useEffect(() => {
        if (activeIndex < 0 || !dropdownRef.current || !flatResults.length) return;

        const dropdown = dropdownRef.current;
        const allItems = dropdown.querySelectorAll('[data-search-item]');
        const activeItem = allItems[activeIndex];
        if (!activeItem) return;

        const dropdownTop = dropdown.scrollTop;
        const dropdownBottom = dropdownTop + dropdown.clientHeight;
        const itemTop = activeItem.offsetTop;
        const itemBottom = itemTop + activeItem.offsetHeight;

        if (itemTop < dropdownTop) {
            dropdown.scrollTo({ top: itemTop, behavior: "smooth" });
        } else if (itemBottom > dropdownBottom) {
            dropdown.scrollTo({ top: itemBottom - dropdown.clientHeight, behavior: "smooth" });
        }
    }, [activeIndex, flatResults]);

    return (
        <div className={styles.search_bar_header_container} ref={containerRef}>
            <input
                type="text"
                value={searchString}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => { loadSearchData(); setDropdownOpen(true); }}
                className={styles.search_bar_input}
                placeholder="Search"
                aria-label="Search"
            />
            {dropdownOpen && filteredResults.length > 0 && (
                <div
                    className={styles.search_results_dropdown}
                    ref={dropdownRef}
                    role="listbox"
                >
                    {filteredResults.map((group) => (
                        <div key={group.key} className={styles.resultGroup}>
                            <div className={styles.stickyHeader}>{group.key === "cable_id" ? "Lead ID" : formatKey(group.key)}</div>
                            {group.values.map((result) => {
                                const flatIndex = flatResults.indexOf(result);
                                const highlightClass =
                                    flatIndex === activeIndex
                                        ? styles.highlighted_result
                                        : flatIndex === hoverIndex
                                            ? styles.hoverHighlight
                                            : "";

                                return (
                                    <div
                                        key={`${group.key}:${result.value}`}
                                        className={`${styles.search_results_item} ${highlightClass}`}
                                        data-search-item
                                        role="option"
                                        aria-selected={flatIndex === activeIndex}
                                        onMouseEnter={() => setHoverIndex(flatIndex)}
                                        onMouseLeave={() => setHoverIndex(-1)}
                                        onClick={() => handleResultClick(result)}
                                    >
                                        {getHighlightedValue(result.value)}
                                    </div>

                                );
                            })}
                            {group.hiddenCount > 0 && (
                                <div className={styles.search_results_more}>
                                    {group.hiddenCount} more, keep typing
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
