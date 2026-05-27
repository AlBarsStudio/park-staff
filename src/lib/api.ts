// src/lib/api.ts
// Замени этот URL на URL твоей будущей функции в Яндекс Облаке
const API_URL = 'https://your-yandex-cloud-function-url.com'; 

export const api = {
  async query(yql: string, params: any = {}) {
    // Это заготовка для запроса к бэкенду, который будет дергать YDB
    const response = await fetch(`${API_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yql, params })
    });
    return response.json();
  }
};
