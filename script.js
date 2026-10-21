/* SkyCast app logic. API responses stay in metric units so the unit toggle is instant. */
(() => {
  'use strict';

  const API_ROOT = 'https://api.openweathermap.org/data/2.5';
  const GEO_ROOT = 'https://api.openweathermap.org/geo/1.0';
  const DEFAULT_CITY = 'Pune';
  const STORAGE = { city: 'skycast-last-city', recent: 'skycast-recent-cities', theme: 'skycast-theme', unit: 'skycast-unit' };
  const WEATHER_ICONS = { '01d':'☀️','01n':'🌙','02d':'🌤️','02n':'☁️','03d':'☁️','03n':'☁️','04d':'☁️','04n':'☁️','09d':'🌧️','09n':'🌧️','10d':'🌦️','10n':'🌧️','11d':'⛈️','11n':'⛈️','13d':'❄️','13n':'❄️','50d':'🌫️','50n':'🌫️' };
  const $ = (selector) => document.querySelector(selector);
  const elements = {
    input: $('#city-search'), form: $('#search-form'), suggestions: $('#suggestions'), status: $('#status-message'),
    currentCard: $('#current-card'), city: $('#current-city'), date: $('#current-date'), time: $('#local-time'), icon: $('#current-icon'),
    temp: $('#temperature'), degree: $('#degree-unit'), condition: $('#condition'), feels: $('#feels-like'), sunrise: $('#sunrise'), sunset: $('#sunset'),
    humidity: $('#humidity'), wind: $('#wind'), pressure: $('#pressure'), visibility: $('#visibility'), hourly: $('#hourly-list'), daily: $('#daily-list'),
    recent: $('#recent-list'), location: $('#location-button'), theme: $('#theme-toggle'), clear: $('#clear-search')
  };
  let currentWeather = null;
  let currentForecast = null;
  let selectedUnit = localStorage.getItem(STORAGE.unit) || 'metric';
  let searchTimer = null;
  let activeRequest = 0;

  // Add one city to the URL only after encoding it, so punctuation is safe.
  async function requestJson(url) {
    let response;
    try { response = await fetch(url); }
    catch (error) { throw new Error('network'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || 'Weather request failed');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function requireApiKey() {
    if (typeof API_KEY === 'undefined' || !API_KEY || API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
      showError('Add your OpenWeatherMap key to config.js. Copy config.example.js, paste your key, then reload this page.');
      return false;
    }
    return true;
  }

  async function getCoordinates(city) {
    const places = await requestJson(`${GEO_ROOT}/direct?q=${encodeURIComponent(city)}&limit=5&appid=${API_KEY}`);
    if (!places.length) { const error = new Error('city'); throw error; }
    return places[0];
  }

  async function getWeather(lat, lon) {
    return requestJson(`${API_ROOT}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
  }

  async function getForecast(lat, lon) {
    return requestJson(`${API_ROOT}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
  }

  // Current conditions and forecast load together to keep each city change quick.
  async function loadCity(city, options = {}) {
    if (!requireApiKey()) return;
    const requestId = ++activeRequest;
    clearTimeout(searchTimer);
    setLoading(true);
    clearStatus();
    hideSuggestions();
    try {
      const place = options.coordinates || await getCoordinates(city);
      const [weather, forecast] = await Promise.all([getWeather(place.lat, place.lon), getForecast(place.lat, place.lon)]);
      if (requestId !== activeRequest) return;
      currentWeather = weather;
      currentForecast = forecast;
      renderCurrent(weather);
      renderForecast(forecast);
      updateTheme(weather);
      const label = `${weather.name}, ${weather.sys.country}`;
      elements.input.value = weather.name;
      localStorage.setItem(STORAGE.city, weather.name);
      addRecent(label, weather.name);
      setLoading(false);
      if (options.message) showMessage(options.message, 'success');
    } catch (error) {
      if (requestId !== activeRequest) return;
      setLoading(false);
      showError(messageForError(error));
    }
  }

  function messageForError(error) {
    if (error.message === 'city') return 'We couldn’t find that city. Check the spelling and try another place.';
    if (error.message === 'network') return 'No internet connection. Check your network, then try again.';
    if (error.status === 401) return 'Your OpenWeatherMap key is invalid or not active yet. Check config.js and try again.';
    if (error.status === 429) return 'Weather requests are temporarily rate limited. Please wait a moment and try again.';
    if (error.status === 404) return 'We couldn’t find weather data for that place. Try another city.';
    if (error.status === 403) return 'This API key does not have access to the requested service. Check your OpenWeatherMap account.';
    return 'Something went wrong while loading the weather. Please try again.';
  }

  function renderCurrent(weather) {
    const offset = weather.timezone || 0;
    const localNow = new Date((weather.dt + offset) * 1000);
    elements.city.textContent = `${weather.name}, ${weather.sys.country}`;
    elements.date.textContent = new Intl.DateTimeFormat(undefined, { weekday:'long', month:'long', day:'numeric', timeZone:'UTC' }).format(localNow).toUpperCase();
    elements.time.textContent = `Local time · ${formatTime(weather.dt, offset)}`;
    elements.icon.textContent = iconFor(weather.weather[0].icon);
    elements.icon.setAttribute('aria-label', weather.weather[0].description);
    elements.temp.textContent = Math.round(displayTemperature(weather.main.temp));
    elements.degree.textContent = selectedUnit === 'metric' ? 'C' : 'F';
    elements.condition.textContent = weather.weather[0].description;
    elements.feels.textContent = `${Math.round(displayTemperature(weather.main.feels_like))}°${selectedUnit === 'metric' ? 'C' : 'F'}`;
    elements.humidity.textContent = `${weather.main.humidity}%`;
    elements.wind.textContent = `${formatNumber(displayWind(weather.wind.speed))} ${selectedUnit === 'metric' ? 'km/h' : 'mph'}`;
    elements.pressure.textContent = `${weather.main.pressure} hPa`;
    const distance = weather.visibility / 1000;
    elements.visibility.textContent = `${formatNumber(selectedUnit === 'metric' ? distance : distance * 0.621371)} ${selectedUnit === 'metric' ? 'km' : 'mi'}`;
    elements.sunrise.textContent = formatTime(weather.sys.sunrise, offset);
    elements.sunset.textContent = formatTime(weather.sys.sunset, offset);
  }

  function renderForecast(forecast) {
    const nextHours = forecast.list.slice(0, 8);
    elements.hourly.replaceChildren(...nextHours.map((item, index) => {
      const card = document.createElement('article');
      card.className = 'hour-card';
      const localDate = new Date((item.dt + forecast.city.timezone) * 1000);
      card.append(makeText('div', index === 0 ? 'Now' : formatHour(localDate), 'hour-time'));
      card.append(makeText('span', iconFor(item.weather[0].icon), 'hour-icon'));
      card.lastChild.setAttribute('role', 'img');
      card.lastChild.setAttribute('aria-label', item.weather[0].description);
      card.append(makeText('div', `${Math.round(displayTemperature(item.main.temp))}°`, 'hour-temp'));
      card.append(makeText('div', `${item.pop ? Math.round(item.pop * 100) : 0}% rain`, 'hour-pop'));
      return card;
    }));

    const grouped = new Map();
    forecast.list.forEach((item) => {
      const key = localDateKey(item.dt, forecast.city.timezone);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
    const days = [...grouped.values()].slice(0, 5);
    elements.daily.replaceChildren(...days.map((items, index) => {
      const temps = items.map((item) => item.main.temp);
      const representative = items[Math.floor(items.length / 2)];
      const row = document.createElement('div');
      row.className = 'day-row';
      const date = new Date((representative.dt + forecast.city.timezone) * 1000);
      row.append(makeText('span', index === 0 ? 'Today' : new Intl.DateTimeFormat(undefined, { weekday:'short', timeZone:'UTC' }).format(date), 'day-name'));
      const icon = makeText('span', iconFor(representative.weather[0].icon), 'day-icon');
      icon.setAttribute('role', 'img'); icon.setAttribute('aria-label', representative.weather[0].description);
      row.append(icon, makeText('span', representative.weather[0].description, 'day-description'));
      const temperature = document.createElement('span');
      temperature.className = 'day-temperatures';
      temperature.append(makeText('span', `${Math.round(displayTemperature(Math.max(...temps)))}°`, 'max'));
      temperature.append(makeText('span', `${Math.round(displayTemperature(Math.min(...temps)))}°`, 'min'));
      row.append(temperature);
      return row;
    }));
  }

  function makeText(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function toggleUnit(unit) {
    selectedUnit = unit;
    localStorage.setItem(STORAGE.unit, unit);
    document.querySelectorAll('.unit-button').forEach((button) => {
      const selected = button.dataset.unit === unit;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (currentWeather) renderCurrent(currentWeather);
    if (currentForecast) renderForecast(currentForecast);
  }

  function displayTemperature(celsius) { return selectedUnit === 'metric' ? celsius : (celsius * 9 / 5) + 32; }
  function displayWind(metersPerSecond) { return selectedUnit === 'metric' ? metersPerSecond * 3.6 : metersPerSecond * 2.23694; }
  function formatNumber(number) { return Number(number).toFixed(1).replace(/\.0$/, ''); }
  function iconFor(code) { return WEATHER_ICONS[code] || '🌤️'; }
  function formatTime(timestamp, offset) { return new Intl.DateTimeFormat(undefined, { hour:'numeric', minute:'2-digit', timeZone:'UTC' }).format(new Date((timestamp + offset) * 1000)); }
  function formatHour(date) { return new Intl.DateTimeFormat(undefined, { hour:'numeric', timeZone:'UTC' }).format(date); }
  function localDateKey(timestamp, offset) { return new Date((timestamp + offset) * 1000).toISOString().slice(0, 10); }

  function updateTheme(weather) {
    const main = weather.weather[0].main.toLowerCase();
    const condition = main.includes('thunder') ? 'thunderstorm' : main.includes('rain') || main.includes('drizzle') ? 'rain' : main.includes('snow') ? 'snow' : main.includes('mist') || main.includes('fog') || main.includes('haze') ? 'mist' : main.includes('cloud') ? 'clouds' : 'clear';
    const isNight = weather.weather[0].icon.endsWith('n');
    document.body.dataset.condition = isNight && condition === 'clear' ? 'night' : condition;
    if (isNight && condition === 'clouds') document.body.dataset.condition = 'night';
  }

  function setLoading(isLoading) {
    elements.currentCard.classList.toggle('loading', isLoading);
    elements.hourly.classList.toggle('loading', isLoading);
    elements.daily.classList.toggle('loading', isLoading);
    elements.currentCard.setAttribute('aria-busy', String(isLoading));
    if (isLoading) showMessage('Finding the latest forecast…', '');
  }

  function showMessage(message, type) { elements.status.textContent = message; elements.status.className = `status-message ${type}`.trim(); }
  function clearStatus() { elements.status.textContent = ''; elements.status.className = 'status-message'; }
  function showError(message) { showMessage(message, 'error'); }

  async function showSuggestions(query) {
    if (query.trim().length < 2 || !requireApiKey()) { hideSuggestions(); return; }
    try {
      const places = await requestJson(`${GEO_ROOT}/direct?q=${encodeURIComponent(query.trim())}&limit=5&appid=${API_KEY}`);
      if (elements.input.value.trim() !== query.trim()) return;
      elements.suggestions.replaceChildren();
      places.forEach((place) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button'; button.setAttribute('role', 'option');
        const label = [place.name, place.state, place.country].filter(Boolean).join(', ');
        button.append(makeText('span', '⌖', 'suggestion-pin'), makeText('span', label));
        button.addEventListener('click', () => loadCity(label, { coordinates: place }));
        item.append(button); elements.suggestions.append(item);
      });
      elements.suggestions.hidden = places.length === 0;
      elements.input.setAttribute('aria-expanded', String(places.length > 0));
    } catch (_) { hideSuggestions(); }
  }

  function hideSuggestions() { clearTimeout(searchTimer); elements.suggestions.hidden = true; elements.input.setAttribute('aria-expanded', 'false'); }

  function addRecent(label, city) {
    let recent = JSON.parse(localStorage.getItem(STORAGE.recent) || '[]');
    recent = recent.filter((item) => item.city.toLowerCase() !== city.toLowerCase());
    recent.unshift({ label, city });
    recent = recent.slice(0, 5);
    localStorage.setItem(STORAGE.recent, JSON.stringify(recent));
    renderRecent(recent);
  }

  function renderRecent(recent = JSON.parse(localStorage.getItem(STORAGE.recent) || '[]')) {
    elements.recent.replaceChildren();
    if (!recent.length) { elements.recent.append(makeText('li', 'Your recent searches will appear here.', 'empty-recent')); return; }
    recent.forEach((item) => {
      const li = document.createElement('li');
      const button = makeText('button', item.label);
      button.type = 'button'; button.addEventListener('click', () => loadCity(item.city));
      li.append(button); elements.recent.append(li);
    });
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    elements.theme.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    elements.theme.firstElementChild.textContent = theme === 'dark' ? '☼' : '☾';
  }

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const city = elements.input.value.trim();
    if (city) loadCity(city);
  });
  elements.input.addEventListener('input', () => {
    elements.clear.hidden = !elements.input.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => showSuggestions(elements.input.value), 350);
  });
  elements.input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideSuggestions();
    if (event.key === 'ArrowDown' && !elements.suggestions.hidden) { event.preventDefault(); elements.suggestions.querySelector('button')?.focus(); }
  });
  elements.clear.addEventListener('click', () => { elements.input.value = ''; elements.clear.hidden = true; hideSuggestions(); elements.input.focus(); });
  document.addEventListener('click', (event) => { if (!event.target.closest('.search-panel')) hideSuggestions(); });
  document.querySelectorAll('.unit-button').forEach((button) => button.addEventListener('click', () => toggleUnit(button.dataset.unit)));
  elements.theme.addEventListener('click', () => {
    const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE.theme, nextTheme); applyTheme(nextTheme);
  });
  elements.location.addEventListener('click', () => {
    if (!navigator.geolocation) { showError('Your browser does not support location sharing. Search for a city instead.'); return; }
    if (!requireApiKey()) return;
    showMessage('Getting your location…', '');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      loadCity('My location', { coordinates: { lat: coords.latitude, lon: coords.longitude }, message: 'Showing your current location.' });
    }, (error) => {
      const message = error.code === error.PERMISSION_DENIED ? 'Location access was denied. Allow location access in your browser, or search for a city.' : error.code === error.TIMEOUT ? 'Location lookup timed out. Try again or search for a city.' : 'We couldn’t determine your location. Search for a city instead.';
      showError(message);
    }, { timeout: 10000, maximumAge: 300000 });
  });

  applyTheme(localStorage.getItem(STORAGE.theme) || 'dark');
  toggleUnit(selectedUnit);
  renderRecent();
  if (location.protocol === 'file:') showMessage('For live weather and autocomplete, open this folder through Live Server or another local web server.', '');
  loadCity(localStorage.getItem(STORAGE.city) || DEFAULT_CITY);
})();
