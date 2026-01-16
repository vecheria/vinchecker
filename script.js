document.addEventListener('DOMContentLoaded', () => {
    const vinInput = document.getElementById('vinInput');
    const checkBtn = document.getElementById('checkBtn');
    const resultsDiv = document.getElementById('results');
    const errorDiv = document.getElementById('error');

    // Елементи фільтра і лічильника
    const filterControls = document.getElementById('filter-controls');
    const filterInput = document.getElementById('filterInput');
    const fieldCount = document.getElementById('fieldCount');

    // Посилання на OSINT секцію
    const osintDiv = document.getElementById('osint-links');

    // Показати повідомлення про помилку
    function showError(msg) {
        errorDiv.textContent = msg;
        errorDiv.classList.remove('hidden');
    }

    // Приховати повідомлення про помилку
    function hideError() {
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
    }

    // Основна функція перевірки VIN
    async function checkVin() {
        const vin = vinInput.value.trim().toUpperCase();
        hideError();
        resultsDiv.innerHTML = '';
        // Приховати панель фільтрації
        if (filterControls) {
            filterControls.classList.add('hidden');
        }
        // Clear recall information section
        const recallsDiv = document.getElementById('recalls');
        if (recallsDiv) {
            recallsDiv.innerHTML = '';
        }
        // Clear ratings section
        const ratingsDiv = document.getElementById('ratings');
        if (ratingsDiv) {
            ratingsDiv.innerHTML = '';
        }

        // Hide OSINT links section
        if (osintDiv) {
            osintDiv.classList.add('hidden');
        }

        // Перевірити довжину та формат
        if (!vin) {
            showError('Будь ласка, введіть VIN.');
            return;
        }
        if (vin.length !== 17) {
            showError('VIN повинен містити 17 символів.');
            return;
        }

        // Перевірити контрольну цифру VIN (позиція 9)
        const checkResult = validateVinCheckDigit(vin);
        if (checkResult && !checkResult.isValid) {
            // Попередити користувача, але не блокувати запит
            showError(`Контрольна цифра VIN некоректна (очікувано: ${checkResult.expected}, отримано: ${checkResult.actual}).`);
        }

        try {
            const combinedData = {};

            // Викликати розширене декодування VIN і додати всі непорожні поля
            try {
                const extUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinExtended/${encodeURIComponent(vin)}?format=json`;
                const extResp = await fetch(extUrl);
                if (extResp.ok) {
                    const extJson = await extResp.json();
                    if (extJson.Results && extJson.Results.length > 0) {
                        // Словник перекладів англійських назв змінних у українські
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
                            'Number of Doors': 'Двері',
                            'Trim': 'Комплектація',
                            'Series': 'Серія',
                            'Engine Model': 'Модель двигуна',
                            'Engine Manufacturer': 'Виробник двигуна',
                            'GVWR': 'Повна маса',
                            'Seat Belts All': 'Кількість ременів',
                            'Steering Location': 'Розташування керма',
                            'Number of Seats': 'Кількість місць',
                            'Number of Seat Rows': 'Кількість рядів сидінь'
                        };
                        extJson.Results.forEach(item => {
                            const varName = item.Variable;
                            const varValue = item.Value;
                            if (!varValue) return;
                            const translated = translations[varName] || varName;
                            // Уникати перезапису вже заповнених значень
                            if (!combinedData[translated]) {
                                combinedData[translated] = varValue;
                            }
                        });
                    }
                }
            } catch (extErr) {
                // Ігнорувати помилки при розширеному декодуванні
            }

            // Якщо модельний рік не визначено, спробувати розрахувати його за 10‑м символом VIN
            if (!combinedData['Рік']) {
                const estimatedYear = decodeModelYear(vin);
                if (estimatedYear) {
                    combinedData['Орієнтовний рік'] = estimatedYear;
                }
            }

            // Отримати дані про WMI для першого блока VIN (позиції 1–3)
            const wmi = vin.substring(0, 3);
            try {
                const wmiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeWMI/${encodeURIComponent(wmi)}?format=json`;
                const wmiResp = await fetch(wmiUrl);
                if (wmiResp.ok) {
                    const wmiJson = await wmiResp.json();
                    if (wmiJson.Results && wmiJson.Results.length > 0) {
                        const wmiData = wmiJson.Results[0];
                        if (wmiData.Country) combinedData['Країна (WMI)'] = wmiData.Country;
                        if (wmiData.Mfr_CommonName) {
                            combinedData['Виробник'] = wmiData.Mfr_CommonName;
                        } else if (wmiData.Mfr_Name) {
                            combinedData['Виробник'] = wmiData.Mfr_Name;
                        }
                        // Додати типи транспортних засобів, якщо доступно
                        if (Array.isArray(wmiData.VehicleTypes) && wmiData.VehicleTypes.length > 0) {
                            const typeNames = wmiData.VehicleTypes.map(v => v.Name).filter(Boolean).join(', ');
                            if (typeNames) combinedData['Тип транспортного засобу'] = typeNames;
                        }
                    }
                }
            } catch (wmiErr) {
                // Нічого не робити, якщо WMI запит не вдався
            }

            // Якщо регіон виробництва ще не визначено, встановити його за першою літерою VIN
            if (!combinedData['Регіон']) {
                const reg = decodeRegion(vin.charAt(0));
                if (reg) combinedData['Регіон'] = reg;
            }

            /*
             * Функції для отримання даних з інших джерел.
             * Українські відкриті дані можуть вимагати попереднього скачування CSV або API.
             * Європейські сторонні API (наприклад, Auto.dev або CarMD) часто потребують ключа доступу.
             * У цьому шаблоні показано, де можна додати такі запити.
             */

            // Приклад запиту до Auto.dev (потрібен ключ)
            // const autoDevKey = 'YOUR_AUTO_DEV_API_KEY';
            // const autoDevUrl = `https://auto.dev/api/vin/${encodeURIComponent(vin)}?apikey=${autoDevKey}`;
            // try {
            //     const autoResp = await fetch(autoDevUrl);
            //     if (autoResp.ok) {
            //         const autoData = await autoResp.json();
            //         // Обробити autoData та додати до combinedData
            //         if (autoData.year && !combinedData['Рік']) combinedData['Рік'] = autoData.year;
            //         if (autoData.make) combinedData['Марка'] = autoData.make;
            //         if (autoData.model) combinedData['Модель'] = autoData.model;
            //         if (autoData.trim) combinedData['Комплектація'] = autoData.trim;
            //         // інші поля за необхідності
            //     }
            // } catch (autoErr) {
            //     // ігнорувати помилки
            // }

            displayResults(combinedData);
            // Показати OSINT‑посилання для історії та фото
            displayOsintLinks(vin);

            // Після відображення основних даних запитати відкликання
            const make = combinedData['Марка'];
            const model = combinedData['Модель'];
            const year = combinedData['Рік'] || combinedData['Орієнтовний рік'];
            if (make && model && year) {
                try {
                    const recalls = await fetchRecalls(make, model, year);
                    if (recalls && recalls.length > 0) {
                        displayRecalls(recalls);
                    }
                } catch (recErr) {
                    // ігнорувати помилки
                }
                // Отримати рейтинги безпеки
                try {
                    const rating = await fetchSafetyRatings(make, model, year);
                    if (rating) {
                        displayRatings(rating);
                    }
                } catch (rateErr) {
                    // ігнорувати помилки
                }
            }
        } catch (err) {
            showError('Сталася помилка під час отримання даних.');
        }
    }

    /**
     * Розрахувати модельний рік за 10‑м символом VIN.
     * Використовується стандарт ISO, за яким 10‑й символ кодує рік у 30‑річних циклах.
     * Якщо 7‑й символ VIN (позиція 7) є числом, то цикл 1980–2009; якщо літера — 2010–2039【489448951291194†L540-L548】.
     * Повертає число або null.
     */
    function decodeModelYear(vin) {
        const yearChar = vin.charAt(9);
        if (!yearChar) return null;
        // Визначити цикл за 7‑м символом
        const pos7 = vin.charAt(6);
        const isFirstCycle = /\d/.test(pos7); // numeric – перший цикл (1980–2009), літера – другий цикл (2010–2039)
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

    /**
     * Визначити регіон за першою літерою VIN.
     * Перший символ WMI вказує на регіон виробництва: A‑C — Африка; H‑R — Азія; S‑Z — Європа【136159633163054†L154-L188】.
     * Також цифри 1‑5 позначають Північну Америку, 6‑7 — Океанію, 8‑9 — Південну Америку.
     * Повертає назву регіону або null.
     */
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

    /**
     * Перевірити контрольну цифру VIN.
     * Використовує алгоритм зваженої суми: кожен символ перетворюється у числове значення, 
     * перемножується на вагу для відповідної позиції й сумується. 
     * За правилом модуль 11 10 позначається як 'X'. Повертає обʼєкт з очікуваною та фактичною цифрою.
     * Джерело: NHTSA опис алгоритму контрольної цифри【710911846496241†L40-L88】.
     */
    function validateVinCheckDigit(vin) {
        if (!vin || vin.length !== 17) return null;
        const transl = {
            '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
            'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
            'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
            'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
        };
        const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
        let sum = 0;
        for (let i = 0; i < 17; i++) {
            if (i === 8) continue; // skip check digit position
            const char = vin.charAt(i);
            const val = transl[char] !== undefined ? transl[char] : 0;
            sum += val * weights[i];
        }
        const remainder = sum % 11;
        const expected = remainder === 10 ? 'X' : String(remainder);
        const actual = vin.charAt(8);
        return { expected, actual, isValid: expected === actual };
    }

    /**
     * Отримати рейтинги безпеки для певної комбінації рік‑марка‑модель.
     * Використовує API NHTSA SafetyRatings, яке повертає спочатку список варіантів з VehicleId, 
     * а потім деталі за VehicleId【296042088082613†L155-L180】.
     * Повертає обʼєкт з ключовими полями або null.
     */
    async function fetchSafetyRatings(make, model, year) {
        try {
            const variantUrl = `https://api.nhtsa.gov/SafetyRatings/modelyear/${encodeURIComponent(year)}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`;
            const varResp = await fetch(variantUrl);
            if (!varResp.ok) return null;
            const varData = await varResp.json();
            if (!varData.Results || varData.Results.length === 0) return null;
            const vehicleId = varData.Results[0].VehicleId;
            if (!vehicleId) return null;
            const ratingUrl = `https://api.nhtsa.gov/SafetyRatings/VehicleId/${vehicleId}`;
            const ratingResp = await fetch(ratingUrl);
            if (!ratingResp.ok) return null;
            const ratingData = await ratingResp.json();
            if (!ratingData.Results || ratingData.Results.length === 0) return null;
            return ratingData.Results[0];
        } catch (err) {
            return null;
        }
    }

    /**
     * Відобразити рейтинги безпеки у блоку #ratings. 
     * Формує таблицю з основними полями: загальний рейтинг, фронтальний, боковий, перекидання, 
     * можливість перекидання, кількість скарг, кількість відкликань, кількість розслідувань, 
     * та наявність систем допомоги водієві.
     */
    function displayRatings(rating) {
        const container = document.getElementById('ratings');
        if (!container || !rating) return;
        container.innerHTML = '';
        const heading = document.createElement('h2');
        heading.textContent = 'Рейтинги безпеки та статистика';
        container.appendChild(heading);
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        function addRow(label, value) {
            if (value === undefined || value === null || value === '') return;
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = label;
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(th);
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        addRow('Загальний рейтинг', rating.OverallRating);
        addRow('Фронтальний рейтинг', rating.OverallFrontCrashRating);
        addRow('Боковий рейтинг', rating.OverallSideCrashRating);
        addRow('Рейтинг перекидання', rating.RolloverRating);
        addRow('Ймовірність перекидання', rating.RolloverPossibility);
        addRow('Кількість скарг', rating.ComplaintsCount);
        addRow('Кількість відкликань', rating.RecallsCount);
        addRow('Кількість розслідувань', rating.InvestigationCount);
        addRow('ESC (електронний контроль стійкості)', rating.NHTSAElectronicStabilityControl);
        addRow('Попередження про фронтальне зіткнення', rating.NHTSAForwardCollisionWarning);
        addRow('Попередження про вихід зі смуги', rating.NHTSALaneDepartureWarning);
        table.appendChild(tbody);
        container.appendChild(table);
    }

    /**
     * Отримати список відкликань для певної марки, моделі та року.
     * API NHTSA дозволяє отримати відкликання за комбінацією make-model-year, за документацією【859234890598821†L330-L345】.
     * Повертає масив об’єктів із номером кампанії та коротким описом.
     */
    async function fetchRecalls(make, model, year) {
        const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const data = await resp.json();
        if (!data || !data.results) return [];
        return data.results.slice(0, 5).map(item => ({
            campaignNumber: item.campaignNumber || '',
            summary: item.summary || ''
        }));
    }

    /**
     * Відобразити список відкликань у блоку #recalls.
     */
    function displayRecalls(recalls) {
        const container = document.getElementById('recalls');
        if (!container) return;
        container.innerHTML = '';
        const heading = document.createElement('h2');
        heading.textContent = 'Кампанії відкликання';
        container.appendChild(heading);
        const list = document.createElement('ul');
        recalls.forEach(rec => {
            const li = document.createElement('li');
            li.textContent = `${rec.campaignNumber}: ${rec.summary}`;
            list.appendChild(li);
        });
        container.appendChild(list);
    }

    /**
     * Відобразити OSINT‑посилання для пошуку фото та історії автомобіля.
     * Створює кілька кнопок‑посилань, які відкривають Google Search з фільтром за VIN на певних ресурсах.
     *
     * @param {string} vin
     */
    function displayOsintLinks(vin) {
        if (!osintDiv || !vin) return;
        const linksContainer = osintDiv.querySelector('.links-container');
        if (!linksContainer) return;
        osintDiv.classList.remove('hidden');
        linksContainer.innerHTML = '';
        // Перелік джерел OSINT‑пошуку. Змінено AutoStat на Poctra згідно з рекомендаціями.
        const sources = [
            {
                name: '📷 Фото з аукціонів (BidFax)',
                url: `https://www.google.com/search?q=${vin}+site:bidfax.info`,
                color: '#d32f2f',
                textColor: '#fff'
            },
            {
                name: '🔍 Історія продажів (Poctra)',
                url: `https://www.google.com/search?q=${vin}+site:poctra.com`,
                color: '#1976d2',
                textColor: '#fff'
            },
            {
                name: '🖼️ Всі зображення Google',
                url: `https://www.google.com/search?tbm=isch&q=${vin}`,
                color: '#388e3c',
                textColor: '#fff'
            },
            {
                name: '🇺🇦 Пошук в Україні (Google)',
                url: `https://www.google.com/search?q=${vin}+site:ua`,
                color: '#fbc02d',
                textColor: '#000'
            }
        ];
        sources.forEach(src => {
            const a = document.createElement('a');
            a.href = src.url;
            a.target = '_blank';
            a.textContent = src.name;
            a.style.cssText = `
                text-decoration: none;
                background-color: ${src.color};
                color: ${src.textColor || '#fff'};
                padding: 10px 15px;
                border-radius: 4px;
                font-size: 0.9rem;
                font-weight: bold;
                flex: 1 1 auto;
                text-align: center;
                min-width: 150px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            a.onmouseover = () => a.style.opacity = '0.9';
            a.onmouseout = () => a.style.opacity = '1';
            linksContainer.appendChild(a);
        });
    }

    // Відобразити результати у вигляді таблиці
    function displayResults(dataObj) {
        // Список некоректних або незначущих значень (у нижньому регістрі)
        const invalidPatterns = [
            'not applicable',
            'n/a',
            'na',
            'unknown',
            'null',
            'не застосовується',
            'невідомо'
        ];
        // Отримати ключі з непорожніми та значущими значеннями
        let keys = Object.keys(dataObj).filter(key => {
            const val = dataObj[key];
            if (val === undefined || val === null) return false;
            const lower = String(val).trim().toLowerCase();
            // Прибрати, якщо значення порожнє або містить некоректний шаблон
            if (!lower || invalidPatterns.some(p => lower === p || lower.includes(p))) {
                return false;
            }
            return true;
        });
        // Сортування: спочатку найважливіші поля, потім за абеткою
        const priority = [
            'Марка','Модель','Рік','Країна (завод)','Місто заводу','Тип кузова','Тип палива','Тип палива (2)',
            'Об’єм двигуна (л)','Об’єм двигуна (см³)','КПП','Тип приводу','Кількість циліндрів','Двері',
            'Комплектація','Серія','Модель двигуна','Виробник двигуна','Повна маса','Кількість ременів',
            'Розташування керма','Кількість місць','Кількість рядів сидінь',
            'Країна (WMI)','Виробник','Тип транспортного засобу','Регіон','Орієнтовний рік'
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
        // Створити таблицю та наповнити її рядками
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        keys.forEach(key => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-key', key.toLowerCase());
            tr.setAttribute('data-value', String(dataObj[key]).toLowerCase());
            const tdKey = document.createElement('th');
            tdKey.textContent = key;
            const tdVal = document.createElement('td');
            tdVal.textContent = dataObj[key];
            tr.appendChild(tdKey);
            tr.appendChild(tdVal);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        resultsDiv.appendChild(table);
        // Показати панель фільтрації та оновити лічильник
        if (filterControls) {
            filterControls.classList.remove('hidden');
            fieldCount.textContent = `${keys.length} полів`;
            filterInput.value = '';
            // Обробник фільтра
            filterInput.oninput = function() {
                const search = this.value.trim().toLowerCase();
                let visibleCount = 0;
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(row => {
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

    // Дозволити натискання Enter
    vinInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkBtn.click();
        }
    });
});
