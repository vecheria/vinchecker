/* Загальні налаштування */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: Arial, sans-serif;
    background-color: #f9f9f9;
    color: #333;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

header {
    background-color: #ffffff;
    padding: 1rem 2rem;
    border-bottom: 1px solid #e0e0e0;
    text-align: center;
}

header h1 {
    font-size: 1.5rem;
    font-weight: 600;
}

main {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    gap: 1.5rem;
    flex: 1;
}

@media (min-width: 768px) {
    main {
        flex-direction: row;
        padding: 2rem;
        gap: 2rem;
    }
}

#checker {
    flex: 2;
    background-color: #fff;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.input-group {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

input[type="text"] {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
}

button {
    padding: 0.75rem 1.5rem;
    border: none;
    background-color: #0a6ebd;
    color: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    min-width: 120px;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: background-color 0.2s;
}

button:hover:not(:disabled) {
    background-color: #095da1;
}

button:disabled {
    background-color: #8bbce3;
    cursor: not-allowed;
}

/* Loader Spinner */
.loader {
    width: 20px;
    height: 20px;
    border: 3px solid #ffffff;
    border-bottom-color: transparent;
    border-radius: 50%;
    display: inline-block;
    box-sizing: border-box;
    animation: rotation 1s linear infinite;
}

@keyframes rotation {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

#error {
    color: #d32f2f;
    margin-top: 0.75rem;
    font-size: 0.95rem;
    background-color: #ffebee;
    padding: 0.5rem;
    border-radius: 4px;
    border-left: 4px solid #d32f2f;
}

.warning-box {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background-color: #fff3cd;
    border-left: 4px solid #ffc107;
    color: #856404;
    font-size: 0.95rem;
    border-radius: 4px;
}

.hidden {
    display: none !important;
}

#results {
    margin-top: 1rem;
    overflow-x: auto;
    transition: opacity 0.3s;
}

#results table {
    width: 100%;
    border-collapse: collapse;
}

#results th,
#results td {
    border: 1px solid #e0e0e0;
    padding: 0.5rem;
    text-align: left;
    font-size: 0.9rem;
}

#results th {
    background-color: #f0f0f0;
    font-weight: bold;
    width: 40%;
}

/* Секція відкликань та рейтингів */
#recalls, #ratings {
    margin-top: 1.5rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
}

h2 {
    font-size: 1.2rem;
    margin-bottom: 0.75rem;
    color: #333;
}

ul {
    list-style: disc inside;
    padding-left: 0.5rem;
}

li {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    line-height: 1.4;
}

/* Контроль фільтра */
.filter-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
}

.filter-controls input {
    padding: 0.5rem;
    font-size: 0.9rem;
}

.field-count {
    font-size: 0.9rem;
    color: #555;
    white-space: nowrap;
}

#ad-placeholder {
    flex: 1;
    min-height: 200px;
    background-color: #ffffff;
    border: 2px dashed #e0e0e0;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 0.9rem;
    color: #888;
    padding: 1rem;
}

footer {
    background-color: #f5f5f5;
    padding: 1rem;
    text-align: center;
    font-size: 0.8rem;
    border-top: 1px solid #e0e0e0;
    margin-top: auto;
}
