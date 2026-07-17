import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../contexts/app";
import formatKey from "../../utils/formatKey";
import callApi from "../../utils/api/callApi";
import styles from "../../styles/styles.module.css";

export default function SearchBar() {
    const [searchData, setSearchData] = useState([]);
    const [searchableEntries, setSearchableEntries] = useState([]);
    const [searchString, setSearchString] = useState("");
    const [filteredResults, setFilteredResults] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [hoverIndex, setHoverIndex] = useState(-1);
    const isMounted = useRef(false);

    const DEBOUNCE_DELAY = 250;
    const MAX_VISIBLE_RESULTS = 50;
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const { setSearchSelection } = useAppContext()

    // Fetch data
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            callApi("search-data", {}).then((response) => {
                setSearchData(response || []);
            });
        }
    }, [searchData]);

    // Flatten data into searchable entries
    useEffect(() => {
        if (!searchData.length) return;

        const entries = [];
        searchData.forEach((row) => {
            Object.keys(row).forEach((key) => {
                const value = row[key];
                if (value !== undefined && value !== null && String(value).trim() !== "") {
                    entries.push({
                        rowId: row.id ?? Math.random(),
                        key,
                        value,
                        originalRow: row,
                        searchableText: String(value).toLowerCase(),
                    });
                }
            });
        });
        setSearchableEntries(entries);
    }, [searchData]);

    const handleInputChange = (event) => {
        setSearchString(event.target.value);
        setActiveIndex(-1);
    };

    // Debounced search
    useEffect(() => {
        const priority = ["customer_order_number", "order_id", "batch_id", "sensor_id", "cable_id"];
        const incrementalSearch = (value) => {
            if (!value || !searchableEntries.length) {
                setFilteredResults([]);
                return;
            }

            const keywords = value
                .split(" ")
                .map((k) => k.trim())
                .filter((k) => k.length > 0);

            const resultsMap = new Map();

            searchableEntries.forEach((entry) => {
                if (keywords.some((k) => entry.searchableText.includes(k))) {
                    const mapKey = `${entry.key}:${entry.value}`;
                    if (!resultsMap.has(mapKey)) {
                        resultsMap.set(mapKey, {
                            key: entry.key,
                            value: entry.value,
                            highlightedValue: entry.value,
                        });
                    }
                }
            });

            // Group by key
            const grouped = {};
            Array.from(resultsMap.values()).forEach((r) => {
                if (!grouped[r.key]) grouped[r.key] = [];
                grouped[r.key].push(r);
            });

            // Sort keys by priority
            const sortedResults = priority
                .filter((k) => grouped[k])
                .map((k) => ({ key: k, values: grouped[k] }));

            setFilteredResults(sortedResults.slice(0, MAX_VISIBLE_RESULTS));
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
        const flatResults = filteredResults.flatMap((g) => g.values);
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
        const flatResults = filteredResults.flatMap((g) => g.values);
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
    }, [activeIndex, filteredResults]);

    return (
        <div className={styles.search_bar_header_container}>
            <input
                type="text"
                value={searchString}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className={styles.search_bar_input}
                placeholder="Search"
                aria-label="Search"
            />
            {filteredResults.length > 0 && (
                <div
                    className={styles.search_results_dropdown}
                    ref={dropdownRef}
                    role="listbox"
                >
                    {filteredResults.map((group) => (
                        <div key={group.key} className={styles.resultGroup}>
                            <div className={styles.stickyHeader}>{formatKey(group.key)}</div>
                            {group.values.map((result, idx) => {
                                const flatIndex = filteredResults
                                    .flatMap((g) => g.values)
                                    .indexOf(result);
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
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
