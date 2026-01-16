document.addEventListener('DOMContentLoaded', () => {
    const vinInput = document.getElementById('vinInput');
    const checkBtn = document.getElementById('checkBtn');
    const resultsDiv = document.getElementById('results');
    const errorDiv = document.getElementById('error');

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

        // Перевірити довжину та формат
        if (!vin) {
            showError('Будь ласка, введіть VIN.');
            return;
        }
        if (vin.length !== 17) {
            showError('VIN повинен містити 17 символів.');
            return;
        }

        try {
            const combinedData = {};

            // Отримати дані від NHTSA (США)
            const vpicUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
            const vpicResp = await fetch(vpicUrl);
            if (vpicResp.ok) {
                const json = await vpicResp.json();
                if (json.Results && json.Results[0]) {
                    const row = json.Results[0];
                    // Зберегти ключові значення
                    combinedData['Країна (USA)'] = row['PlantCountry'] || '';
                    combinedData['Марка'] = row['Make'] || '';
                    combinedData['Модель'] = row['Model'] || '';
                    combinedData['Рік'] = row['ModelYear'] || '';
                    combinedData['Тип кузова'] = row['BodyClass'] || '';
                    combinedData['Тип палива'] = row['FuelTypePrimary'] || row['FuelTypeSecondary'] || '';
                    combinedData['Об’єм двигуна (л)'] = row['DisplacementL'] || '';
                    combinedData['Об’єм двигуна (см³)'] = row['DisplacementCC'] || '';
                    combinedData['КПП'] = row['TransmissionStyle'] || '';
                    combinedData['Тип приводу'] = row['DriveType'] || '';
                }
            }

            /*
             * Функції для отримання даних з інших джерел.
             * Українські відкриті дані можуть вимагати попереднього скачування CSV або API.
             * Європейські сторонні API (наприклад, vindecoder.eu або clearvin) часто потребують ключа доступу.
             * У цьому шаблоні показано, де можна додати такі запити.
             */

            // Приклад запиту до стороннього API (потрібен ключ)
            // const apiKey = 'YOUR_API_KEY';
            // const apiSecret = 'YOUR_SECRET_KEY';
            // const europeUrl = `https://api.vindecoder.eu/3.2/${apiKey}/${controlSum}/decode/${vin}.json`;
            // const europeResp = await fetch(europeUrl);
            // if (europeResp.ok) {
            //     const europeJson = await europeResp.json();
            //     // Обробити відповіді та додати до combinedData
            // }

            displayResults(combinedData);
        } catch (err) {
            showError('Сталася помилка під час отримання даних.');
        }
    }

    // Відобразити результати у вигляді таблиці
    function displayResults(dataObj) {
        const keys = Object.keys(dataObj).filter(key => dataObj[key]);
        if (!keys.length) {
            resultsDiv.textContent = 'Дані не знайдено.';
            return;
        }
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        keys.forEach(key => {
            const tr = document.createElement('tr');
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