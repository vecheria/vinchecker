document.addEventListener('DOMContentLoaded', () => {
    const vinInput = document.getElementById('vinInput');
    const checkBtn = document.getElementById('checkBtn');
    const btnText = checkBtn.querySelector('.btn-text');
    const btnLoader = checkBtn.querySelector('.loader');
    
    const resultsDiv = document.getElementById('results');
    const errorDiv = document.getElementById('error');
    const warningDiv = document.getElementById('warning');
    const recallsDiv = document.getElementById('recalls');
    const ratingsDiv = document.getElementById('ratings');

    // Елементи фільтра
    const filterControls = document.getElementById('filter-controls');
    const filterInput = document.getElementById('filterInput');
    const fieldCount = document.getElementById('fieldCount');

    // Відновлення останнього VIN з пам'яті
    const savedVin = localStorage.getItem('lastVin');
    if (savedVin) {
        vinInput.value = savedVin;
    }

    // Розширений словник перекладів
    const translations = {
        'Make': 'Марка',
        'Model': 'Модель',
        'Model Year': 'Рік',
        'Plant Country': 'Країна (завод)',
        'Plant City': 'Місто заводу',
        'Body Class': 'Тип кузова',
        'Fuel Type - Primary': 'Тип палива',
        'Fuel Type - Secondary': 'Тип палива (2)',
        'Displacement (L)': 'Об’єм двигуна (л)',
        'Displacement (CC)': 'Об’єм двигуна (см³)',
        'Transmission Style': 'КПП',
        'Drive Type': 'Тип приводу',
        'Engine Cylinders': 'Кількість циліндрів',
        'Doors': 'Двері',
        'Trim': 'Комплектація',
        'Series': 'Серія',
        'Engine Model': 'Модель двигуна',
        'Engine Manufacturer': 'Виробник двигуна',
        'GVWR': 'Повна маса',
        'Seat Belts All': 'Кількість ременів',
        'Steering Location': 'Розташування керма',
        'Number of Seats': 'Кількість місць',
        'Electrification Level': 'Рівень електрифікації',
        'Battery Info': 'Інформація про батарею',
        'Battery Type': 'Тип батареї',
        'EV Drive Unit': 'Електропривід',
        'Turbo': 'Турбонадув',
        'Top Speed (MPH)': 'Макс. швидкість (миль/год)',
        'Active Safety System Note': 'Системи безпеки (примітка)',
        'Other Engine Info': 'Інфо про двигун'
    };

    // --- Допоміжні функції UI ---

    function showError(msg) {
        errorDiv.textContent = msg;
        errorDiv.classList.remove('hidden');
    }

    function showWarning(msg) {
        warningDiv.textContent = msg;
        warningDiv.classList.remove('hidden');
    }

    function clearMessages() {
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
        warningDiv.classList.add('hidden');
        warningDiv.textContent = '';
    }

    function clearResults() {
        resultsDiv.innerHTML = '';
        recallsDiv.innerHTML = '';
        ratingsDiv.innerHTML = '';
        if (filterControls) filterControls.classList.add('hidden');
    }

    function setLoading(isLoading) {
        checkBtn.disabled = isLoading;
        if (isLoading) {
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
            resultsDiv.style.opacity = '0.5';
        } else {
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
            resultsDiv.style.opacity = '1';
        }
    }

    // --- Основна логіка ---

    async function checkVin() {
        const vin = vinInput.value.trim().toUpperCase();
        
        clearMessages();
        clearResults();

        // 1. Валідація
        if (!vin) {
            showError('Будь ласка, введіть VIN.');
            return;
        }
        if (vin.length !== 17) {
            showError('VIN повинен містити 17 символів.');
            return;
        }
        // Заборонені символи (I, O, Q)
        if (/[IOQ]/.test(vin)) {
            showError('VIN код не може містити літери I, O або Q. Перевірте правильність введення.');
            return;
        }

        // Зберігаємо VIN
        localStorage.setItem('lastVin', vin);

        // Перевірка контрольної цифри (попередження, а не блокування)
        const checkResult = validateVinCheckDigit(vin);
        if (checkResult && !checkResult.isValid) {
            showWarning(`Увага! Контрольна цифра VIN некоректна (очікувано: ${checkResult.expected}, фактично: ${checkResult.actual}). Це може свідчити про підробку або помилку запису.`);
        }

        setLoading(true);

        try {
            // 2. Паралельний запит основних даних та WMI
            const extUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinExtended/${encodeURIComponent(vin)}?format=json`;
            const wmi = vin.substring(0, 3);
            const wmiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeWMI/${encodeURIComponent(wmi)}?format=json`;

            const [extResult, wmiResult] = await Promise.allSettled([
                fetch(extUrl).then(r => r.json()),
                fetch(wmiUrl).then(r => r.json())
            ]);

            const combinedData = {};

            // Обробка розширених даних
            if (extResult.status === 'fulfilled' && extResult.value.Results) {
                extResult.value.Results.forEach(item => {
                    const varName = item.Variable;
                    const varValue = item.Value;
                    if (!varValue) return;
                    
                    const translated = translations[varName] || varName;
                    if (!combinedData[translated]) {
                        combinedData[translated] = varValue;
                    }
                });
            } else {
                showError('Не вдалося отримати основні дані від сервера NHTSA.');
            }

            // Fallback для року та регіону
            if (!combinedData['Рік']) {
                const estYear = decodeModelYear(vin);
                if (estYear) combinedData['Орієнтовний рік'] = estYear;
            }
            if (!combinedData['Регіон']) {
                const reg = decodeRegion(vin.charAt(0));
                if (reg) combinedData['Регіон'] = reg;
            }

            // Обробка WMI
            if (wmiResult.status === 'fulfilled' && wmiResult.value.Results) {
                const wmiData = wmiResult.value.Results[0];
                if (wmiData) {
                    if (wmiData.Country) combinedData['Країна (WMI)'] = wmiData.Country;
                    if (wmiData.Mfr_CommonName || wmiData.Mfr_Name) {
                        combinedData['Виробник'] = wmiData.Mfr_CommonName || wmiData.Mfr_Name;
                    }
                }
            }

            // Відображаємо основну таблицю
            displayResults(combinedData);

            // 3. Додаткові дані (Відкликання та Рейтинги) - тільки якщо є Марка/Модель/Рік
            const make = combinedData['Марка'];
            const model = combinedData['Модель'];
            const year = combinedData['Рік'] || combinedData['Орієнтовний рік'];

            if (make && model && year) {
                // Паралельний запуск вторинних запитів
                const [recallsRes, ratingsRes] = await Promise.allSettled([
                    fetchRecalls(make, model, year),
                    fetchSafetyRatings(make, model, year)
                ]);

                if (recallsRes.status === 'fulfilled' && recallsRes.value.length > 0) {
                    displayRecalls(recallsRes.value);
                }
                
                if (ratingsRes.status === 'fulfilled' && ratingsRes.value) {
                    displayRatings(ratingsRes.value);
                }
            }

        } catch (err) {
            console.error(err);
            showError('Сталася критична помилка під час обробки даних.');
        } finally {
            setLoading(false);
        }
    }

    // --- Логіка декодування ---

    function decodeModelYear(vin) {
        const yearChar = vin.charAt(9);
        const pos7 = vin.charAt(6);
        const isFirstCycle = /\d/.test(pos7);
        const mapping = {
            'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7,
            'J': 8, 'K': 9, 'L': 10, 'M': 11, 'N': 12, 'P': 13, 'R': 14,
            'S': 15, 'T': 16, 'V': 17, 'W': 18, 'X': 19, 'Y': 20,
            '1': 21, '2': 22, '3': 23, '4': 24, '5': 25, '6': 26,
            '7': 27, '8': 28, '9': 29
        };
        const offset = mapping[yearChar];
        if (offset === undefined) return null;
        const baseYear = 1980 + offset;
        return isFirstCycle ? baseYear : baseYear + 30;
    }

    function decodeRegion(firstChar) {
        if (!firstChar) return null;
        const ch = firstChar.toUpperCase();
        if ('ABC'.includes(ch)) return 'Африка';
        if ('HJKLMNPR'.includes(ch)) return 'Азія';
        if ('STUVWXYZ'.includes(ch)) return 'Європа';
        if ('12345'.includes(ch)) return 'Північна Америка';
        if ('67'.includes(ch)) return 'Океанія';
        if ('89'.includes(ch)) return 'Південна Америка';
        return null;
    }

    function validateVinCheckDigit(vin) {
        const transl = {
            '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
            'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
            'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
            'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
        };
        const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
        let sum = 0;
        for (let i = 0; i < 17; i++) {
            if (i === 8) continue;
            const char = vin.charAt(i);
            const val = transl[char] !== undefined ? transl[char] : 0;
            sum += val * weights[i];
        }
        const remainder = sum % 11;
        const expected = remainder === 10 ? 'X' : String(remainder);
        const actual = vin.charAt(8);
        return { expected, actual, isValid: expected === actual };
    }

    // --- API запити ---

    async function fetchSafetyRatings(make, model, year) {
        try {
            const variantUrl = `https://api.nhtsa.gov/SafetyRatings/modelyear/${encodeURIComponent(year)}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`;
            const varResp = await fetch(variantUrl);
            if (!varResp.ok) return null;
            const varData = await varResp.json();
            if (!varData.Results || varData.Results.length === 0) return null;
            const vehicleId = varData.Results[0].VehicleId;
            
            const ratingUrl = `https://api.nhtsa.gov/SafetyRatings/VehicleId/${vehicleId}`;
            const ratingResp = await fetch(ratingUrl);
            if (!ratingResp.ok) return null;
            const ratingData = await ratingResp.json();
            return ratingData.Results && ratingData.Results.length > 0 ? ratingData.Results[0] : null;
        } catch {
            return null;
        }
    }

    async function fetchRecalls(make, model, year) {
        try {
            const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
            const resp = await fetch(url);
            if (!resp.ok) return [];
            const data = await resp.json();
            return data.results ? data.results.slice(0, 5) : [];
        } catch {
            return [];
        }
    }

    // --- Відображення даних ---

    function displayRatings(rating) {
        ratingsDiv.innerHTML = '';
        const heading = document.createElement('h2');
        heading.textContent = 'Рейтинги безпеки (NHTSA)';
        ratingsDiv.appendChild(heading);

        const table = document.createElement('table');
        const tbody = document.createElement('tbody');

        const fields = [
            ['Загальний рейтинг', rating.OverallRating],
            ['Фронтальний удар', rating.OverallFrontCrashRating],
            ['Боковий удар', rating.OverallSideCrashRating],
            ['Перекидання', rating.RolloverRating],
            ['Кількість скарг', rating.ComplaintsCount],
            ['Кількість відкликань', rating.RecallsCount]
        ];

        fields.forEach(([label, value]) => {
            if (value && value !== 'Not Rated') {
                const tr = document.createElement('tr');
                tr.innerHTML = `<th>${label}</th><td>${value}</td>`;
                tbody.appendChild(tr);
            }
        });

        table.appendChild(tbody);
        ratingsDiv.appendChild(table);
    }

    function displayRecalls(recalls) {
        recallsDiv.innerHTML = '';
        const heading = document.createElement('h2');
        heading.textContent = `Знайдено кампаній відкликання: ${recalls.length} (показано останні 5)`;
        recallsDiv.appendChild(heading);
        const list = document.createElement('ul');
        recalls.forEach(rec => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${rec.campaignNumber}</strong>: ${rec.summary}`;
            list.appendChild(li);
        });
        recallsDiv.appendChild(list);
    }

    function displayResults(dataObj) {
        const invalidPatterns = ['not applicable', 'n/a', 'na', 'unknown', 'null', 'не застосовується'];
        
        let keys = Object.keys(dataObj).filter(key => {
            const val = dataObj[key];
            if (val === undefined || val === null) return false;
            const lower = String(val).trim().toLowerCase();
            return !(!lower || invalidPatterns.some(p => lower === p));
        });

        // Пріоритетне сортування
        const priority = [
            'Марка','Модель','Рік','Орієнтовний рік','Комплектація',
            'Об’єм двигуна (л)','Тип палива','КПП','Тип приводу',
            'Країна (завод)','Виробник','Регіон'
        ];

        keys.sort((a, b) => {
            const ia = priority.indexOf(a);
            const ib = priority.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return a.localeCompare(b);
        });

        if (!keys.length) {
            resultsDiv.textContent = 'Дані не знайдено.';
            return;
        }

        const table = document.createElement('table');
        const tbody = document.createElement('tbody');

        keys.forEach(key => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-key', key.toLowerCase());
            tr.setAttribute('data-value', String(dataObj[key]).toLowerCase());
            tr.innerHTML = `<th>${key}</th><td>${dataObj[key]}</td>`;
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        resultsDiv.appendChild(table);

        if (filterControls) {
            filterControls.classList.remove('hidden');
            fieldCount.textContent = `${keys.length} полів`;
            filterInput.value = '';
            
            filterInput.oninput = function() {
                const search = this.value.trim().toLowerCase();
                let visibleCount = 0;
                tbody.querySelectorAll('tr').forEach(row => {
                    const keyData = row.getAttribute('data-key');
                    const valueData = row.getAttribute('data-value');
                    if (!search || keyData.includes(search) || valueData.includes(search)) {
                        row.style.display = '';
                        visibleCount++;
                    } else {
                        row.style.display = 'none';
                    }
                });
                fieldCount.textContent = search ? `${visibleCount} з ${keys.length} полів` : `${keys.length} полів`;
            };
        }
    }

    checkBtn.addEventListener('click', checkVin);
    vinInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkBtn.click();
        }
    });
});
